/** @jest-environment node */

import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchClientSecret } from "./stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ origin: "http://localhost:3000" })),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { checkout: { sessions: { create: jest.fn(), expire: jest.fn() } } },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("fetchClientSecret", () => {
  const mockCreateSession = stripe.checkout.sessions.create as jest.Mock;
  const mockCreateClient = createSupabaseClient as jest.Mock;
  const mockCreateService = createSupabaseServiceClient as jest.Mock;

  const queryResolving = (data: unknown) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data }),
      single: async () => ({ data }),
    };
    return query;
  };

  it("records the buyer and event on the session so /return can find the payment row", async () => {
    const tableData: Record<string, unknown> = {
      user_profiles: { stripe_customer_id: "cus_1" },
      events: { visibility: "public", approval_status: "approved" },
      pricing_tiers: { stripe_price_id: "price_1", is_active: true },
    };
    const from = (table: string) => queryResolving(tableData[table]);
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from,
    });
    mockCreateService.mockReturnValue({
      from,
      rpc: jest.fn(async () => ({ data: "payment-1", error: null })),
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
          product_type: "event",
          event_id: "event-1",
          user_id: "user-1",
        },
      })
    );
  });
});
