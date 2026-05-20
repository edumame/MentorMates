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
 * Get pricing tier by UUID ID
 */
export function getPricingTierById(pricingTiers: PricingTier[], id: string): PricingTier | null {
  return pricingTiers.find(tier => tier.id === id) || null;
}
