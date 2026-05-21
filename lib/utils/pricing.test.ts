import {
  DEFAULT_PAYMENT_CURRENCY,
  PAYMENT_CURRENCY_OPTIONS,
  formatPrice,
  getCheapestPricingTier,
  getPaidEventJoinLabel,
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

describe("PAYMENT_CURRENCY_OPTIONS", () => {
  it("includes common international currencies for payment display", () => {
    expect(PAYMENT_CURRENCY_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "hkd", label: "HKD" }),
        expect.objectContaining({ value: "cny", label: "RMB / CNY" }),
        expect.objectContaining({ value: "jpy", label: "JPY" }),
        expect.objectContaining({ value: "krw", label: "KRW" }),
        expect.objectContaining({ value: "sgd", label: "SGD" }),
      ])
    );
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

describe("getPaidEventJoinLabel", () => {
  it("shows the cheapest tier price without requiring auth state", () => {
    expect(
      getPaidEventJoinLabel([
        makeTier({ price: 3000, currency: "usd" }),
        makeTier({ id: "tier-2", price: 2500, currency: "hkd" }),
      ])
    ).toBe("Join Event - From HK$25.00");
  });

  it("falls back when a paid event has no pricing tiers", () => {
    expect(getPaidEventJoinLabel([])).toBe("Join Event - Paid Event");
  });
});
