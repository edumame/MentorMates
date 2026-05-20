import {
  DEFAULT_PAYMENT_CURRENCY,
  formatPrice,
  getCheapestPricingTier,
} from "./pricing";
import type { PricingTier } from "@/lib/types";

function makeTier(overrides: Partial<PricingTier> = {}): PricingTier {
  return {
    id: "tier-1",
    event_id: "event-1",
    tier_id: "regular",
    name: "Regular",
    price: 2500,
    currency: DEFAULT_PAYMENT_CURRENCY,
    stripe_price_id: "price_123",
    is_active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe("formatPrice", () => {
  it("formats USD by default for existing pricing tiers", () => {
    expect(formatPrice(2500)).toBe("$25.00");
  });

  it("formats non-USD currencies", () => {
    expect(formatPrice(2500, "eur")).toBe("€25.00");
  });

  it("falls back to a readable amount when Intl rejects the currency", () => {
    expect(formatPrice(2500, "not-a-currency")).toBe("NOT-A-CURRENCY 25.00");
  });
});

describe("getCheapestPricingTier", () => {
  it("returns the cheapest available tier without losing currency metadata", () => {
    expect(
      getCheapestPricingTier([
        makeTier({ id: "tier-1", price: 3000, currency: "usd" }),
        makeTier({ id: "tier-2", price: 2500, currency: "eur" }),
      ])
    ).toMatchObject({
      id: "tier-2",
      price: 2500,
      currency: "eur",
    });
  });
});
