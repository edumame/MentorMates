import { PricingTier } from "@/lib/types";

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
 * Format price from cents to display string
 */
export function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(2)}`;
}

/**
 * Get pricing tier by ID
 */
export function getPricingTierById(pricingTiers: PricingTier[], id: string): PricingTier | null {
  return pricingTiers.find(tier => tier.id === id) || null;
}