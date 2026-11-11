import { PricingTier } from "@/lib/types";

export const DEFAULT_PAYMENT_CURRENCY = "usd";

export const PAYMENT_CURRENCY_OPTIONS = [
  { value: "usd", label: "USD" },
  { value: "hkd", label: "HKD" },
  { value: "cny", label: "RMB / CNY" },
  { value: "eur", label: "EUR" },
  { value: "gbp", label: "GBP" },
  { value: "cad", label: "CAD" },
  { value: "aud", label: "AUD" },
  { value: "nzd", label: "NZD" },
  { value: "jpy", label: "JPY" },
  { value: "krw", label: "KRW" },
  { value: "sgd", label: "SGD" },
  { value: "inr", label: "INR" },
  { value: "myr", label: "MYR" },
  { value: "thb", label: "THB" },
  { value: "php", label: "PHP" },
  { value: "idr", label: "IDR" },
  { value: "vnd", label: "VND" },
  { value: "chf", label: "CHF" },
  { value: "sek", label: "SEK" },
  { value: "nok", label: "NOK" },
  { value: "dkk", label: "DKK" },
  { value: "mxn", label: "MXN" },
  { value: "brl", label: "BRL" },
  { value: "aed", label: "AED" },
] as const;

// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

export function isZeroDecimalCurrency(currency?: string | null): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency?.trim().toLowerCase() ?? "");
}

/**
 * Convert a typed amount to the integer smallest-unit value Stripe expects.
 */
export function toMinorUnits(
  amount: number,
  currency = DEFAULT_PAYMENT_CURRENCY
): number {
  return Math.round(isZeroDecimalCurrency(currency) ? amount : amount * 100);
}

/**
 * Get available pricing tiers for an event
 * Filters out expired or sold-out tiers
 */
export function getAvailablePricingTiers(pricingTiers: PricingTier[]): PricingTier[] {
  const now = new Date();
  
  return pricingTiers.filter(tier => {
    // Check if tier is still available (not expired)
    if (tier.available_until) {
      const availableUntil = new Date(tier.available_until);
      if (availableUntil < now) {
        return false;
      }
    }
    
    // Check if tier has reached max quantity
    if (tier.max_quantity && tier.current_quantity) {
      if (tier.current_quantity >= tier.max_quantity) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get the cheapest available pricing tier
 */
export function getCheapestPricingTier(pricingTiers: PricingTier[]): PricingTier | null {
  const availableTiers = getAvailablePricingTiers(pricingTiers);
  
  if (availableTiers.length === 0) {
    return null;
  }
  
  return availableTiers.reduce((cheapest, current) => 
    current.price < cheapest.price ? current : cheapest
  );
}

export function getPaidEventJoinLabel(pricingTiers: PricingTier[]): string {
  if (pricingTiers.length === 0) {
    return "Join Event - Paid Event";
  }

  const cheapestTier = getCheapestPricingTier(pricingTiers);

  return cheapestTier
    ? `Join Event - From ${formatPrice(cheapestTier.price, cheapestTier.currency)}`
    : "Join Event - Multiple Tiers Available";
}

/**
 * Format price from cents to display string.
 */
export function formatPrice(
  priceInCents: number,
  currency = DEFAULT_PAYMENT_CURRENCY
): string {
  const normalizedCurrency =
    currency?.trim().toUpperCase() || DEFAULT_PAYMENT_CURRENCY.toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(priceInCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceInCents / 100).toFixed(2)}`;
  }
}

/**
 * Format a coupon's amount_off, which is in Stripe's smallest currency unit.
 * Tier prices are stored x100 for every currency, so they stay on formatPrice.
 */
export function formatCouponAmount(
  amountOff: number,
  currency = DEFAULT_PAYMENT_CURRENCY
): string {
  return formatPrice(
    isZeroDecimalCurrency(currency) ? amountOff * 100 : amountOff,
    currency
  );
}
