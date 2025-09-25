"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, AccessTime, Inventory } from "@mui/icons-material";
import { PricingTier } from "@/lib/types";
import { formatPrice } from "@/lib/utils/pricing";

interface PricingTierSelectorProps {
  pricingTiers: PricingTier[];
  selectedTierId?: string; // The id string (not the UUID id)
  onTierSelect: (id: string) => void; // Passes id string (not the UUID id)
  onContinue: () => void;
  isLoading?: boolean;
}

export function PricingTierSelector({
  pricingTiers,
  selectedTierId,
  onTierSelect,
  onContinue,
  isLoading = false,
}: PricingTierSelectorProps) {
  const isValidTier = (tier: PricingTier): boolean => {
    // Check if tier is still available
    if (tier.available_until) {
      const availableUntil = new Date(tier.available_until);
      if (availableUntil < new Date()) {
        return false;
      }
    }

    // Check if tier has reached max quantity (if specified)
    if (tier.max_quantity && tier.current_quantity) {
      if (tier.current_quantity >= tier.max_quantity) {
        return false;
      }
    }

    return true;
  };

  const formatAvailableUntil = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Choose Your Pricing Tier</h3>
        <p className="text-sm text-gray-600">
          Select the pricing option that works best for you
        </p>
      </div>

      <div className="space-y-3">
        {pricingTiers.map((tier) => {
          const isAvailable = isValidTier(tier);
          const isSelected = selectedTierId === tier.id;

          return (
            <Card
              key={tier.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-blue-500 border-blue-500"
                  : "hover:border-gray-300"
              } ${!isAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => isAvailable && onTierSelect(tier.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {tier.name}
                    {isSelected && <Check className="h-5 w-5 text-blue-500" />}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-600">
                      {formatPrice(tier.price)}
                    </span>
                    {!isAvailable && (
                      <Badge variant="destructive">Unavailable</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tier.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {tier.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {tier.available_until && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <AccessTime className="h-3 w-3" />
                      Until {formatAvailableUntil(tier.available_until)}
                    </Badge>
                  )}
                  {tier.max_quantity && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Inventory className="h-3 w-3" />
                      {tier.current_quantity || 0}/{tier.max_quantity} sold
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        variant="default"
        onClick={onContinue}
        disabled={!selectedTierId || isLoading}
        className="w-full rounded-full"
      >
        {isLoading ? "Processing..." : "Continue to Payment"}
      </Button>
    </div>
  );
}
