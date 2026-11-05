/** @jest-environment node */

import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { fetchClientSecret } from "./stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: () => "http://localhost:3000",
  }),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const chain = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
};

const mockSupabase = (event: Record<string, unknown> | null) => {
  const tables: Record<string, ReturnType<typeof chain>> = {
    user_profiles: chain({
      data: { stripe_customer_id: "cus_1" },
      error: null,
    }),
    events: chain({ data: event, error: null }),
    pricing_tiers: chain({
      data: { stripe_price_id: "price_1", current_quantity: 0 },
      error: null,
    }),
    user_event_payments: chain({ data: { id: "payment-1" }, error: null }),
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: jest.fn((table: string) => tables[table]),
  });
};

const checkout = () =>
  fetchClientSecret({ eventId: "event-1", pricingTierId: "tier-1" });

describe("fetchClientSecret", () => {
  const createSession = stripe.checkout.sessions.create as jest.Mock;

  beforeEach(() => {
    createSession.mockReset();
    createSession.mockResolvedValue({ id: "cs_1", client_secret: "secret_1" });
  });

  it.each(["public", "draft"])(
    "refuses a new checkout for a rejected %s event",
    async (visibility) => {
      mockSupabase({ visibility, approval_status: "rejected" });

      await expect(checkout()).rejects.toThrow(
        "This event is no longer available.",
      );
      expect(createSession).not.toHaveBeenCalled();
    },
  );

  it("refuses a checkout for an event the buyer cannot read", async () => {
    // A rejected event moved to draft is hidden from non-members by RLS.
    mockSupabase(null);

    await expect(checkout()).rejects.toThrow(
      "This event is no longer available.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    { visibility: "public", approval_status: "approved" },
    { visibility: "private", approval_status: "rejected" },
  ])("allows checkout for %o", async (event) => {
    mockSupabase(event);

    await expect(checkout()).resolves.toBe("secret_1");
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});
