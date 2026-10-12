import type { PricingTier } from "@/lib/types";
import { getAvailablePricingTiers } from "@/lib/utils/pricing";

export type PaidJoinNextStep =
  | { type: "select_pricing"; defaultPricingTierId?: string }
  | { type: "unavailable" };

export function getPaidJoinNextStep(
  pricingTiers: PricingTier[],
  preferredPricingTierId?: string
): PaidJoinNextStep {
  const availableTiers = getAvailablePricingTiers(pricingTiers);

  if (availableTiers.length === 0) {
    return { type: "unavailable" };
  }

  const preferredTier = availableTiers.find(
    (tier) => tier.id === preferredPricingTierId
  );

  return {
    type: "select_pricing",
    defaultPricingTierId: preferredTier?.id ?? availableTiers[0]?.id,
  };
}
