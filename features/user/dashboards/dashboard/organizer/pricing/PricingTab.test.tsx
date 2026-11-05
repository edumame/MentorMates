import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PricingTab } from "./PricingTab";
import { supabase } from "@/lib/supabase";
import type { EventDetails, PricingTier } from "@/lib/types";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/lib/hooks/use-event-archive-status", () => ({
  useEventArchiveStatus: () => ({ isArchived: false }),
}));

jest.mock("./CouponManagement", () => ({ CouponManagement: () => null }));
jest.mock("./PromoCodeManagement", () => ({ PromoCodeManagement: () => null }));

const tier: PricingTier = {
  id: "tier-1",
  event_id: "event-1",
  tier_id: "early-bird",
  name: "Early bird",
  price: 2500,
  currency: "usd",
  stripe_price_id: "price_123",
  max_quantity: 50,
  current_quantity: 12,
  is_active: true,
  sort_order: 0,
};

function mockSupabase() {
  const tierUpdate = jest.fn();
  (supabase.from as jest.Mock).mockImplementation(() => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "insert", "delete", "in"]) {
      query[method] = jest.fn(() => query);
    }
    query.update = jest.fn((values: unknown) => {
      tierUpdate(values);
      return query;
    });
    query.then = (resolve: (value: unknown) => void) =>
      resolve({ data: [tier], error: null });
    return query;
  });
  return tierUpdate;
}

describe("PricingTab", () => {
  it("does not send the sold count when saving an existing tier", async () => {
    const tierUpdate = mockSupabase();
    const user = userEvent.setup();

    render(
      <PricingTab
        event={{ event_id: "event-1", paid: true } as EventDetails}
        setEvent={jest.fn()}
        saving={false}
        setSaving={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: /save/i }));

    await waitFor(() => expect(tierUpdate).toHaveBeenCalled());
    const tierPayload = tierUpdate.mock.calls
      .map(([values]) => values)
      .find((values) => values.tier_id === tier.tier_id);
    expect(tierPayload).toMatchObject({ name: tier.name, max_quantity: 50 });
    expect(tierPayload).not.toHaveProperty("current_quantity");
  });
});
