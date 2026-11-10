import {
  DEFAULT_PAYMENT_CURRENCY,
  PAYMENT_CURRENCY_OPTIONS,
  formatCouponAmount,
  formatPrice,
  getCheapestPricingTier,
  getPaidEventJoinLabel,
  isZeroDecimalCurrency,
  toMinorUnits,
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

describe("zero-decimal coupon amounts", () => {
  it.each(["jpy", "krw", "vnd", "JPY", " jpy "])(
    "treats %j as zero-decimal",
    (currency) => {
      expect(isZeroDecimalCurrency(currency)).toBe(true);
    }
  );

  it.each(["usd", "eur", "idr", "", undefined, null])(
    "treats %j as two-decimal",
    (currency) => {
      expect(isZeroDecimalCurrency(currency)).toBe(false);
    }
  );

  it("does not scale zero-decimal amounts for Stripe", () => {
    expect(toMinorUnits(500, "jpy")).toBe(500);
    expect(toMinorUnits(500, "krw")).toBe(500);
    expect(toMinorUnits(500, "vnd")).toBe(500);
  });

  it("scales two-decimal amounts to cents", () => {
    expect(toMinorUnits(10, "usd")).toBe(1000);
    expect(toMinorUnits(10)).toBe(1000);
  });

  it("always returns the integer Stripe requires", () => {
    expect(toMinorUnits(19.99, "usd")).toBe(1999);
    expect(toMinorUnits(1.1, "usd")).toBe(110);
    expect(toMinorUnits(500.6, "jpy")).toBe(501);
  });

  it("renders the amount Stripe will actually discount", () => {
    expect(formatCouponAmount(500, "jpy")).toBe("\u00a5500");
    expect(formatCouponAmount(50000, "jpy")).toBe("\u00a550,000");
    expect(formatCouponAmount(1000, "usd")).toBe("$10.00");
    expect(formatCouponAmount(1000)).toBe("$10.00");
  });

  it("leaves formatPrice unchanged for x100 tier prices", () => {
    expect(formatPrice(300000, "jpy")).toBe("\u00a53,000");
  });
});
