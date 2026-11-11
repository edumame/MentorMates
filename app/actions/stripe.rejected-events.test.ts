/** @jest-environment node */

import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchClientSecret } from "./stripe";

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: () => "http://localhost:3000",
  }),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const chain = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
};

const mockSupabase = (event: Record<string, unknown> | null) => {
  const tables: Record<string, ReturnType<typeof chain>> = {
    events: chain({ data: event, error: null }),
    pricing_tiers: chain({
      data: { stripe_price_id: "price_1", current_quantity: 0 },
      error: null,
    }),
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: jest.fn((table: string) => tables[table]),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() =>
      chain({ data: { stripe_customer_id: "cus_1" }, error: null }),
    ),
    rpc: jest.fn().mockResolvedValue({ data: "payment-1", error: null }),
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

  it.each([
    { visibility: "public", approval_status: "rejected" },
    { visibility: "private", approval_status: "rejected" },
    { visibility: "draft", approval_status: "rejected" },
    { visibility: "draft", approval_status: "approved" },
    { visibility: "archived", approval_status: "approved" },
    { visibility: "public", approval_status: "submitted" },
  ])("refuses a checkout for an event closed to enrollment: %o", async (event) => {
    mockSupabase(event);

    await expect(checkout()).rejects.toThrow(
      "This event is not open for enrollment.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a checkout for an event the buyer cannot read", async () => {
    // A rejected event moved to draft is hidden from non-members by RLS.
    mockSupabase(null);

    await expect(checkout()).rejects.toThrow(
      "This event is not open for enrollment.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    { visibility: "public", approval_status: "approved" },
    { visibility: "private", approval_status: "not_submitted" },
  ])("allows checkout for %o", async (event) => {
    mockSupabase(event);

    await expect(checkout()).resolves.toBe("secret_1");
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});
