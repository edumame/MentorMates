/** @jest-environment node */
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import { fetchClientSecret } from "./stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ origin: "https://app.test" })),
}));
// The real redirect() throws, so nothing after it may run.
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  },
}));

type PaymentRow = {
  id: string;
  payment_status: string;
  stripe_session_id: string | null;
};

type Call = { table: string; op: string; args: unknown[] };

const CHECKOUT = {
  eventId: "event-1",
  eventSlug: "hack-day",
  pricingTierId: "tier-1",
};
const OVERVIEW_URL = "/events/hack-day/overview";

const createSession = jest.mocked(stripe.checkout.sessions.create);
const retrieveSession = jest.mocked(stripe.checkout.sessions.retrieve);

let calls: Call[];

function paymentWrites() {
  return calls.filter(
    (call) =>
      call.table === "user_event_payments" &&
      ["insert", "update", "upsert"].includes(call.op)
  );
}

function mockSupabase({
  payment = null,
  paymentReadError = null,
  writeResult = { data: [{ id: "payment-1" }], error: null },
  tier = {
    id: "tier-1",
    stripe_price_id: "price_1",
    max_quantity: null,
    current_quantity: 0,
    available_until: null,
  },
}: {
  payment?: PaymentRow | null;
  paymentReadError?: { message: string } | null;
  writeResult?: { data: unknown; error: unknown };
  tier?: Record<string, unknown>;
}) {
  const resultFor = (table: string, ops: string[]) => {
    if (table === "user_profiles") {
      return { data: { stripe_customer_id: "cus_1" }, error: null };
    }
    if (table === "pricing_tiers") {
      return { data: tier, error: null };
    }
    if (ops.some((op) => ["insert", "update", "upsert"].includes(op))) {
      return writeResult;
    }
    return { data: payment, error: paymentReadError };
  };

  const from = (table: string) => {
    const ops: string[] = [];
    const builder: Record<string, unknown> = {
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected: (reason: unknown) => unknown
      ) =>
        Promise.resolve(resultFor(table, ops)).then(onFulfilled, onRejected),
    };
    for (const op of [
      "select",
      "insert",
      "update",
      "upsert",
      "eq",
      "neq",
      "single",
      "maybeSingle",
    ]) {
      builder[op] = (...args: unknown[]) => {
        ops.push(op);
        calls.push({ table, op, args });
        return builder;
      };
    }
    return builder;
  };

  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
    from,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  createSession.mockResolvedValue({
    id: "cs_new",
    client_secret: "secret_new",
    payment_intent: null,
    amount_total: 2000,
    currency: "usd",
  } as never);
});

describe("fetchClientSecret re-entry", () => {
  it("sends a user with a paid record to the event and changes nothing", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "paid",
        stripe_session_id: "cs_paid",
      },
    });

    await expect(fetchClientSecret(CHECKOUT)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith(OVERVIEW_URL);
    expect(createSession).not.toHaveBeenCalled();
    expect(paymentWrites()).toEqual([]);
  });

  it("checks for a paid record before the tier's sold-out check can mask it", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "paid",
        stripe_session_id: "cs_paid",
      },
      tier: {
        id: "tier-1",
        stripe_price_id: "price_1",
        max_quantity: 1,
        current_quantity: 1,
        available_until: null,
      },
    });

    await expect(fetchClientSecret(CHECKOUT)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith(OVERVIEW_URL);
  });

  it("falls back to the event id when the URL has no slug", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "paid",
        stripe_session_id: "cs_paid",
      },
    });

    await expect(
      fetchClientSecret({ eventId: "event-1", pricingTierId: "tier-1" })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/events/event-1/overview");
  });

  it("treats a completed session as paid while the webhook is still pending", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "processing",
        stripe_session_id: "cs_done",
      },
    });
    retrieveSession.mockResolvedValue({ status: "complete" } as never);

    await expect(fetchClientSecret(CHECKOUT)).rejects.toThrow("NEXT_REDIRECT");

    expect(retrieveSession).toHaveBeenCalledWith("cs_done");
    expect(redirect).toHaveBeenCalledWith(OVERVIEW_URL);
    expect(createSession).not.toHaveBeenCalled();
    expect(paymentWrites()).toEqual([]);
  });

  it("does not start a checkout when the payment lookup fails", async () => {
    mockSupabase({ paymentReadError: { message: "db down" } });

    await expect(fetchClientSecret(CHECKOUT)).rejects.toThrow(
      "Failed to check existing payment"
    );

    expect(createSession).not.toHaveBeenCalled();
    expect(paymentWrites()).toEqual([]);
  });

  it("replaces an abandoned session with a write that cannot touch a paid row", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "processing",
        stripe_session_id: "cs_open",
      },
    });
    retrieveSession.mockResolvedValue({ status: "open" } as never);

    await expect(fetchClientSecret(CHECKOUT)).resolves.toBe("secret_new");

    expect(paymentWrites()).toEqual([
      expect.objectContaining({
        op: "update",
        args: [
          expect.objectContaining({
            payment_status: "processing",
            stripe_session_id: "cs_new",
          }),
        ],
      }),
    ]);
    expect(calls).toContainEqual({
      table: "user_event_payments",
      op: "eq",
      args: ["id", "payment-1"],
    });
    expect(calls).toContainEqual({
      table: "user_event_payments",
      op: "neq",
      args: ["payment_status", "paid"],
    });
  });

  it("refuses the new session if the row became paid during checkout setup", async () => {
    mockSupabase({
      payment: {
        id: "payment-1",
        payment_status: "processing",
        stripe_session_id: "cs_open",
      },
      writeResult: { data: [], error: null },
    });
    retrieveSession.mockResolvedValue({ status: "open" } as never);

    await expect(fetchClientSecret(CHECKOUT)).rejects.toThrow(
      "Failed to create user event payment"
    );
  });

  it.each(["canceled", "refunded"])(
    "lets a user with a %s record buy again",
    async (payment_status) => {
      mockSupabase({
        payment: {
          id: "payment-1",
          payment_status,
          stripe_session_id: "cs_old",
        },
      });

      await expect(fetchClientSecret(CHECKOUT)).resolves.toBe("secret_new");

      expect(retrieveSession).not.toHaveBeenCalled();
      expect(paymentWrites().map((call) => call.op)).toEqual(["update"]);
    }
  );

  it("inserts a record on a first checkout", async () => {
    mockSupabase({ payment: null });

    await expect(fetchClientSecret(CHECKOUT)).resolves.toBe("secret_new");

    expect(paymentWrites()).toEqual([
      expect.objectContaining({
        op: "insert",
        args: [
          expect.objectContaining({
            user_id: "user-1",
            event_id: "event-1",
            stripe_session_id: "cs_new",
            payment_status: "processing",
            pricing_id: "tier-1",
          }),
        ],
      }),
    ]);
  });
});
