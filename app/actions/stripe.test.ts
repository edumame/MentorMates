/** @jest-environment node */

import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { fetchClientSecret } from "./stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ origin: "http://localhost:3000" })),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { checkout: { sessions: { create: jest.fn() } } },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

describe("fetchClientSecret", () => {
  const mockCreateSession = stripe.checkout.sessions.create as jest.Mock;
  const mockCreateClient = createSupabaseClient as jest.Mock;

  const queryResolving = (data: unknown) => {
    const query = {
      select: () => query,
      eq: () => query,
      upsert: () => query,
      maybeSingle: async () => ({ data }),
      single: async () => ({ data }),
      then: (resolve: (result: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
    return query;
  };

  it("records who bought what on the session so the webhook need not rely on the row", async () => {
    const tableData: Record<string, unknown> = {
      user_profiles: { stripe_customer_id: "cus_1" },
      pricing_tiers: { stripe_price_id: "price_1" },
      user_event_payments: [{ id: "payment-1" }],
    };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => queryResolving(tableData[table]),
    });
    mockCreateSession.mockResolvedValue({
      id: "cs_1",
      client_secret: "secret",
    });

    await expect(
      fetchClientSecret({ eventId: "event-1", pricingTierId: "tier-1" })
    ).resolves.toBe("secret");

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          user_id: "user-1",
          event_id: "event-1",
          pricing_tier_id: "tier-1",
        },
      })
    );
  });
});
