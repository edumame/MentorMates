/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type RpcResult = { data: unknown; error: { message: string } | null };

const BUYER = "buyer-1";
const PAYMENT_ID = "payment-1";
const SESSION_ID = "cs_test_1";

const completedEvent = (sessionId = SESSION_ID) => ({
  id: "evt_completed",
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      customer: "cus_1",
      amount_total: 5000,
      payment_intent: "pi_1",
    },
  },
});

const refundedEvent = {
  id: "evt_refunded",
  type: "charge.refunded",
  data: { object: { id: "ch_1", payment_intent: "pi_1" } },
};

/** In-memory stand-in for the PostgREST query builder used by the route. */
function createQuery(tables: Tables, table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let operation: "select" | "update" | "delete" = "select";
  let patch: Row = {};

  const run = (): Row[] => {
    const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
    if (operation === "update") {
      rows.forEach((row) => Object.assign(row, patch));
    }
    if (operation === "delete") {
      tables[table] = tables[table].filter((row) => !rows.includes(row));
    }
    return rows;
  };

  const query = {
    select: () => query,
    update: (values: Row) => {
      operation = "update";
      patch = values;
      return query;
    },
    delete: () => {
      operation = "delete";
      return query;
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    single: async () => {
      const rows = run();
      return { data: rows.length === 1 ? rows[0] : null, error: null };
    },
    then: (resolve: (result: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(resolve),
  };

  return query;
}

/**
 * Models the contract of public.fulfill_checkout_session. The SQL itself,
 * including its locking under concurrent delivery, is exercised against real
 * PostgreSQL by scripts/test_checkout_fulfillment.py.
 */
function fulfillCheckoutSession(tables: Tables, args: Row): RpcResult {
  const payment = tables.user_event_payments.find(
    (row) =>
      row.stripe_customer_id === args.p_stripe_customer_id &&
      row.stripe_session_id === args.p_stripe_session_id
  );
  if (!payment) {
    return { data: null, error: null };
  }

  const result = (ticketsIssued: boolean) => ({
    data: {
      id: payment.id,
      event_id: payment.event_id,
      user_id: payment.user_id,
      tickets_issued: ticketsIssued,
    },
    error: null,
  });

  const hasTickets = tables.event_tickets.some((row) => row.payment_id === payment.id);
  if (
    payment.payment_status === "refunded" ||
    (payment.payment_status === "paid" && hasTickets)
  ) {
    return result(false);
  }

  const tier = tables.pricing_tiers.find((row) => row.id === payment.pricing_id);
  if (!tier) {
    return { data: null, error: { message: "pricing tier not found" } };
  }

  Object.assign(payment, {
    payment_status: "paid",
    amount_paid: args.p_amount_paid,
    stripe_payment_intent_id: args.p_stripe_payment_intent_id,
  });
  const buyerNeedsTicket = !tables.event_tickets.some(
    (row) =>
      row.event_id === payment.event_id && row.assigned_to_user_id === payment.user_id
  );
  for (let index = 0; index < (tier.bundle_size as number); index += 1) {
    const assignToBuyer = index === 0 && buyerNeedsTicket;
    tables.event_tickets.push({
      id: `ticket-${tables.event_tickets.length}`,
      event_id: payment.event_id,
      payment_id: payment.id,
      purchased_by_user_id: payment.user_id,
      assigned_to_user_id: assignToBuyer ? payment.user_id : null,
      ticket_status: assignToBuyer ? "assigned" : "unassigned",
    });
  }
  return result(true);
}

function createFakeSupabase(tables: Tables) {
  return {
    from: jest.fn((table: string) => createQuery(tables, table)),
    rpc: jest.fn((name: string, args: Row) => {
      const result: RpcResult =
        name === "fulfill_checkout_session"
          ? fulfillCheckoutSession(tables, args)
          : { data: null, error: { message: `unknown function ${name}` } };
      return { maybeSingle: async () => result };
    }),
  };
}

function deliver(event: unknown) {
  (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);
  return POST(
    new Request("http://localhost/api/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    })
  );
}

describe("POST /api/stripe checkout fulfillment", () => {
  let tables: Tables;
  let supabase: ReturnType<typeof createFakeSupabase>;
  let consoleError: jest.SpyInstance;

  const ticketsForPayment = () =>
    tables.event_tickets.filter((row) => row.payment_id === PAYMENT_ID);
  const buyerTickets = () =>
    ticketsForPayment().filter((row) => row.assigned_to_user_id === BUYER);

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    tables = {
      user_event_payments: [
        {
          id: PAYMENT_ID,
          event_id: "event-1",
          user_id: BUYER,
          pricing_id: "tier-1",
          stripe_customer_id: "cus_1",
          stripe_session_id: SESSION_ID,
          stripe_payment_intent_id: null,
          payment_status: "processing",
        },
      ],
      pricing_tiers: [{ id: "tier-1", bundle_size: 2 }],
      event_tickets: [],
      user_event_roles: [{ id: "role-1", event_id: "event-1", user_id: BUYER }],
    };
    supabase = createFakeSupabase(tables);
    (createSupabaseServiceClient as jest.Mock).mockResolvedValue(supabase);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("issues the bundle and assigns one ticket to the buyer on first delivery", async () => {
    const response = await deliver(completedEvent());

    expect(response.status).toBe(200);
    expect(tables.user_event_payments[0].payment_status).toBe("paid");
    expect(ticketsForPayment()).toHaveLength(2);
    expect(buyerTickets()).toHaveLength(1);
  });

  it("leaves exactly bundle_size tickets when the same event is redelivered", async () => {
    await deliver(completedEvent());
    const redelivery = await deliver(completedEvent());

    expect(redelivery.status).toBe(200);
    expect(ticketsForPayment()).toHaveLength(2);
    expect(buyerTickets()).toHaveLength(1);
  });

  it("holds exactly one buyer ticket after the first delivery and after redelivery", async () => {
    await deliver(completedEvent());
    expect(buyerTickets()).toHaveLength(1);
    expect(buyerTickets()[0].ticket_status).toBe("assigned");

    await deliver(completedEvent());
    expect(buyerTickets()).toHaveLength(1);
    expect(buyerTickets()[0].ticket_status).toBe("assigned");
  });

  it("leaves fulfillment entirely to the function, with no step for a killed delivery to skip", async () => {
    await deliver(completedEvent());
    await deliver(completedEvent());

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("does not assign the buyer a second ticket when they already hold one for the event", async () => {
    tables.event_tickets.push({
      id: "ticket-from-friend",
      event_id: "event-1",
      payment_id: "payment-of-friend",
      purchased_by_user_id: "friend-1",
      assigned_to_user_id: BUYER,
      ticket_status: "assigned",
    });

    await deliver(completedEvent());

    expect(ticketsForPayment()).toHaveLength(2);
    expect(buyerTickets()).toHaveLength(0);
  });

  it("does not reassign tickets on redelivery after the buyer gave theirs away", async () => {
    await deliver(completedEvent());
    const [buyerTicket] = buyerTickets();
    buyerTicket.assigned_to_user_id = "friend-1";

    await deliver(completedEvent());

    expect(buyerTickets()).toHaveLength(0);
    expect(
      ticketsForPayment().filter((row) => row.assigned_to_user_id === "friend-1")
    ).toHaveLength(1);
  });

  it("does not restore a refunded payment when the completed event is resent", async () => {
    await deliver(completedEvent());
    await deliver(refundedEvent);
    expect(ticketsForPayment()).toHaveLength(0);

    const resend = await deliver(completedEvent());

    expect(resend.status).toBe(200);
    expect(tables.user_event_payments[0].payment_status).toBe("refunded");
    expect(ticketsForPayment()).toHaveLength(0);
  });

  it("fails the delivery so Stripe retries when no payment matches the session", async () => {
    await expect(deliver(completedEvent("cs_test_unknown"))).rejects.toThrow(
      "Stripe processing error"
    );

    expect(tables.event_tickets).toHaveLength(0);
  });

  it("keeps a failed fulfillment retryable so the next delivery issues the bundle", async () => {
    tables.pricing_tiers.length = 0;

    await expect(deliver(completedEvent())).rejects.toThrow("Stripe processing error");
    expect(tables.user_event_payments[0].payment_status).toBe("processing");
    expect(tables.event_tickets).toHaveLength(0);

    tables.pricing_tiers.push({ id: "tier-1", bundle_size: 2 });
    await deliver(completedEvent());

    expect(tables.user_event_payments[0].payment_status).toBe("paid");
    expect(ticketsForPayment()).toHaveLength(2);
    expect(buyerTickets()).toHaveLength(1);
  });
});
