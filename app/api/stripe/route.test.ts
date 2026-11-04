/** @jest-environment node */

import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import { POST } from "./route";

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type Write = {
  table: string;
  operation: "update" | "delete";
  values?: unknown;
  filters: Array<[string, unknown]>;
};

const payment = { id: "payment-1", event_id: "event-1", user_id: "buyer-1" };

const buildSupabase = () => {
  const writes: Write[] = [];

  const from = jest.fn((table: string) => {
    const write: Write = { table, operation: "update", filters: [] };
    const result = {
      data: table === "user_event_payments" ? payment : [{ id: "row-1" }],
      error: null,
    };

    const query = {
      update: (values: unknown) => {
        write.values = values;
        writes.push(write);
        return query;
      },
      delete: () => {
        write.operation = "delete";
        writes.push(write);
        return query;
      },
      eq: (column: string, value: unknown) => {
        write.filters.push([column, value]);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        write.filters.push([column, { in: values }]);
        return query;
      },
      select: () => query,
      single: () => query,
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };

    return query;
  });

  return { client: { from }, writes };
};

const deliverChargeRefunded = (charge: {
  amount: number;
  amount_refunded: number;
  refunded: boolean;
}) => {
  (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
    type: "charge.refunded",
    data: { object: { payment_intent: "pi_1", ...charge } },
  });

  return POST(
    new Request("http://localhost/api/stripe", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}",
    }),
  );
};

describe("POST /api/stripe charge.refunded", () => {
  const originalEnv = process.env;
  let supabase: ReturnType<typeof buildSupabase>;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    };
    supabase = buildSupabase();
    (createSupabaseServiceClient as jest.Mock).mockResolvedValue(
      supabase.client,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it.each([
    ["a small goodwill refund", 500],
    ["one seat of a five-ticket bundle", 1000],
    ["everything but one cent", 4999],
  ])("keeps the registration after %s", async (_label, amountRefunded) => {
    const response = await deliverChargeRefunded({
      amount: 5000,
      amount_refunded: amountRefunded,
      refunded: false,
    });

    expect(response.status).toBe(200);
    expect(supabase.writes).toEqual([]);
  });

  it("revokes the registration once the charge is fully refunded", async () => {
    const response = await deliverChargeRefunded({
      amount: 5000,
      amount_refunded: 5000,
      refunded: true,
    });

    expect(response.status).toBe(200);
    expect(supabase.writes).toEqual([
      {
        table: "user_event_payments",
        operation: "update",
        values: { payment_status: "refunded" },
        filters: [["stripe_payment_intent_id", "pi_1"]],
      },
      expect.objectContaining({ table: "user_event_roles", operation: "delete" }),
      {
        table: "event_tickets",
        operation: "delete",
        filters: [["payment_id", payment.id]],
      },
    ]);
  });

  const deliverFullRefund = async () => {
    await deliverChargeRefunded({
      amount: 5000,
      amount_refunded: 5000,
      refunded: true,
    });

    return supabase.writes.find((write) => write.table === "user_event_roles");
  };

  it("only removes the roles that pay for entry on a full refund", async () => {
    const roleDelete = await deliverFullRefund();

    expect(roleDelete?.filters).toEqual([
      ["event_id", payment.event_id],
      ["user_id", payment.user_id],
      ["role", { in: ["participant", "mentor"] }],
    ]);
  });

  it.each([
    ["a paying participant", "participant", true],
    ["a paying mentor", "mentor", true],
    ["an organizer", "organizer", false],
    ["a judge", "judge", false],
    ["an admin", "admin", false],
  ])("on a full refund, %s (%s) revoked: %s", async (_label, role, revoked) => {
    const roleDelete = await deliverFullRefund();
    const roleFilter = roleDelete?.filters.find(
      ([column]) => column === "role",
    )?.[1] as { in: string[] };

    expect(roleFilter.in.includes(role)).toBe(revoked);
  });
});
