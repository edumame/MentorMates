/** @jest-environment node */

import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { POST } from "./route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type Row = Record<string, unknown>;

/** In-memory stand-in that honours eq filters, so a row miss behaves as in PostgREST. */
function createFakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ??= []);
      const filters: Array<[string, unknown]> = [];
      let patch: Row | null = null;
      let inserted: Row[] | null = null;
      let maxRows = Infinity;

      const run = () => {
        if (inserted) {
          const created = inserted.map((row, index) => ({
            id: `${table}-${rows.length + index + 1}`,
            ...row,
          }));
          rows.push(...created);
          return created;
        }
        const matched = rows.filter((row) =>
          filters.every(([column, value]) => row[column] === value)
        );
        if (patch) {
          matched.forEach((row) => Object.assign(row, patch));
        }
        return matched.slice(0, maxRows);
      };

      const builder = {
        select: () => builder,
        order: () => builder,
        limit(count: number) {
          maxRows = count;
          return builder;
        },
        update(values: Row) {
          patch = values;
          return builder;
        },
        insert(values: Row[]) {
          inserted = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        single: async () => {
          const matched = run();
          return { data: matched.length === 1 ? matched[0] : null };
        },
        then: (resolve: (result: { data: Row[] }) => unknown) =>
          Promise.resolve({ data: run() }).then(resolve),
      };

      return builder;
    },
  };
}

describe("POST /api/stripe", () => {
  const mockConstructEvent = stripe.webhooks.constructEvent as jest.Mock;
  const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

  let tables: Record<string, Row[]>;

  const deliver = (type: string, session: Row) => {
    mockConstructEvent.mockReturnValue({ type, data: { object: session } });
    return POST(
      new Request("http://localhost/api/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );
  };

  const sessionFor = (id: string, tierId: string | null) => ({
    id,
    customer: "cus_1",
    amount_total: 5000,
    payment_intent: `pi_${id}`,
    metadata: tierId
      ? { user_id: "user-1", event_id: "event-1", pricing_tier_id: tierId }
      : {},
  });

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";

    // The row was overwritten by a newer checkout for the single-ticket tier.
    tables = {
      user_event_payments: [
        {
          id: "payment-1",
          user_id: "user-1",
          event_id: "event-1",
          stripe_customer_id: "cus_1",
          stripe_session_id: "cs_new",
          pricing_id: "tier-single",
          payment_status: "processing",
        },
      ],
      pricing_tiers: [
        { id: "tier-single", bundle_size: 1 },
        { id: "tier-bundle", bundle_size: 3 },
      ],
      event_tickets: [],
    };
    mockCreateServiceClient.mockResolvedValue(createFakeSupabase(tables));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks the payment and issues the bought tier's tickets for a superseded session", async () => {
    const response = await deliver(
      "checkout.session.completed",
      sessionFor("cs_old", "tier-bundle")
    );

    expect(response.status).toBe(200);
    expect(tables.user_event_payments[0]).toMatchObject({
      payment_status: "paid",
      amount_paid: 5000,
      stripe_payment_intent_id: "pi_cs_old",
      stripe_session_id: "cs_old",
      pricing_id: "tier-bundle",
    });
    expect(tables.event_tickets).toHaveLength(3);
    expect(
      tables.event_tickets.filter(
        (ticket) => ticket.assigned_to_user_id === "user-1"
      )
    ).toHaveLength(1);
  });

  it("does not cancel the paid row when the abandoned newer session expires", async () => {
    await deliver(
      "checkout.session.completed",
      sessionFor("cs_old", "tier-bundle")
    );
    await deliver("checkout.session.expired", sessionFor("cs_new", "tier-single"));

    expect(tables.user_event_payments[0].payment_status).toBe("paid");
  });

  it("still resolves a session created before metadata existed by its session id", async () => {
    await deliver("checkout.session.completed", sessionFor("cs_new", null));

    expect(tables.user_event_payments[0]).toMatchObject({
      payment_status: "paid",
      stripe_session_id: "cs_new",
      pricing_id: "tier-single",
    });
    expect(tables.event_tickets).toHaveLength(1);
  });

  it("fails so Stripe retries when the session's customer does not own the row", async () => {
    await expect(
      deliver("checkout.session.completed", {
        ...sessionFor("cs_old", "tier-bundle"),
        customer: "cus_other",
      })
    ).rejects.toThrow("Stripe processing error");

    expect(tables.user_event_payments[0].payment_status).toBe("processing");
    expect(tables.event_tickets).toHaveLength(0);
  });
});
