/** @jest-environment node */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fetchClientSecret } from "./stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ origin: "https://example.test" })),
}));
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(async () => ({
          id: "cs_1",
          client_secret: "secret_1",
          payment_intent: null,
          amount_total: 2000,
          currency: "usd",
        })),
      },
    },
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const TIER_ID = "33333333-3333-4333-8333-333333333333";

function readQuery(result: unknown) {
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: result, error: null })),
    single: jest.fn(async () => ({ data: result, error: null })),
  };
  return query;
}

function paymentTable(result: { data: unknown; error: unknown }) {
  const select = jest.fn(async () => result);
  const upsert = jest.fn(() => ({ select }));
  return { upsert };
}

function setup(paymentResult: { data: unknown; error: unknown } = { data: [{ id: "payment" }], error: null }) {
  const userPayments = paymentTable({ data: null, error: { message: "new row violates row-level security policy" } });
  const servicePayments = paymentTable(paymentResult);
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: USER_ID } } })) },
    from: jest.fn((table: string) => {
      if (table === "user_profiles") return readQuery({ stripe_customer_id: "cus_1" });
      if (table === "pricing_tiers") {
        return readQuery({ id: TIER_ID, stripe_price_id: "price_1", available_until: null, max_quantity: null });
      }
      if (table === "user_event_payments") return userPayments;
      throw new Error(`unexpected table ${table}`);
    }),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "user_event_payments") return servicePayments;
      throw new Error(`unexpected table ${table}`);
    }),
  });
  return { userPayments, servicePayments };
}

describe("fetchClientSecret payment record", () => {
  it("writes the processing row through the cookie-less service client", async () => {
    const { userPayments, servicePayments } = setup();

    await expect(fetchClientSecret({ eventId: EVENT_ID, pricingTierId: TIER_ID })).resolves.toBe("secret_1");

    expect(userPayments.upsert).not.toHaveBeenCalled();
    expect(servicePayments.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        event_id: EVENT_ID,
        stripe_customer_id: "cus_1",
        stripe_session_id: "cs_1",
        payment_status: "processing",
        pricing_id: TIER_ID,
      }),
      { onConflict: "user_id,event_id" },
    );
  });

  it("fails checkout when the payment record cannot be written", async () => {
    setup({ data: null, error: { message: "boom" } });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(fetchClientSecret({ eventId: EVENT_ID, pricingTierId: TIER_ID })).rejects.toThrow(
      "Failed to create user event payment",
    );

    consoleError.mockRestore();
  });
});

describe("user_event_payments write policies", () => {
  // Replays policy statements in migration order, so a later migration that
  // reintroduces a client write policy fails here as well.
  function remainingPolicies() {
    const dir = join(process.cwd(), "supabase/migrations");
    const policies = new Map<string, string>();
    const statement =
      /(CREATE|DROP)\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"\s+ON\s+(?:"?public"?\.)?"?user_event_payments"?(?:\s+FOR\s+(\w+))?/gi;

    for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
      for (const [, verb, name, command] of readFileSync(join(dir, file), "utf8").matchAll(statement)) {
        if (verb.toUpperCase() === "DROP") policies.delete(name);
        else policies.set(name, (command ?? "ALL").toUpperCase());
      }
    }
    return policies;
  }

  it("leaves users with read-only policies", () => {
    const policies = remainingPolicies();

    expect(policies.size).toBeGreaterThan(0);
    expect([...policies].filter(([, command]) => command !== "SELECT")).toEqual([]);
  });

  it("revokes direct writes from browser roles even if an unknown policy exists", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const revoke =
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+(?:TABLE\s+)?public\.user_event_payments\s+FROM\s+anon,\s*authenticated/i;
    const revoking = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => revoke.test(readFileSync(join(dir, name), "utf8")));

    expect(revoking).toHaveLength(1);
  });
});
