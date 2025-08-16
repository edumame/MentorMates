"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, DollarSign, Calendar, Package } from "lucide-react";
import { EventDetails, PricingTier } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface PricingTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  toast: any; // Use the same type as other tabs
}

export function PricingTab({
  event,
  setEvent,
  saving,
  setSaving,
  toast,
}: PricingTabProps) {
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(
    event.pricing_tiers || []
  );

  const handlePaidToggle = (checked: boolean) => {
    setEvent({ ...event, paid: checked });
    if (!checked) {
      // Clear pricing tiers when making event free
      setPricingTiers([]);
      setEvent({ ...event, paid: checked, pricing_tiers: [] });
    }
  };

  const addPricingTier = () => {
    const newTier: PricingTier = {
      id: `tier-${Date.now()}`,
      name: "",
      price: 0,
      description: "",
    };
    setPricingTiers([...pricingTiers, newTier]);
  };

  const updatePricingTier = (index: number, updates: Partial<PricingTier>) => {
    const updatedTiers = pricingTiers.map((tier, i) =>
      i === index ? { ...tier, ...updates } : tier
    );
    setPricingTiers(updatedTiers);
  };

  const removePricingTier = (index: number) => {
    const updatedTiers = pricingTiers.filter((_, i) => i !== index);
    setPricingTiers(updatedTiers);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          paid: event.paid,
          pricing_tiers: pricingTiers,
        })
        .eq("event_id", event.event_id);

      if (error) throw error;

      setEvent({ ...event, pricing_tiers: pricingTiers });
      toast({
        title: "Success",
        description: "Pricing configuration saved successfully",
      });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast({
        title: "Error",
        description: "Failed to save pricing configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Paid Event Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Event Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="paid-event"
              checked={event.paid || false}
              onCheckedChange={handlePaidToggle}
            />
            <Label htmlFor="paid-event">This is a paid event</Label>
          </div>
          <p className="text-sm text-gray-600">
            Toggle this on to set up pricing tiers for your event. Participants will need to pay to join.
          </p>
        </CardContent>
      </Card>

      {/* Pricing Tiers Configuration */}
      {event.paid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pricing Tiers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pricingTiers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pricing tiers configured</p>
                <p className="text-sm">Add your first pricing tier to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pricingTiers.map((tier, index) => (
                  <Card key={tier.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Tier {index + 1}
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removePricingTier(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tier-name-${index}`}>Tier Name</Label>
                          <Input
                            id={`tier-name-${index}`}
                            value={tier.name}
                            onChange={(e) =>
                              updatePricingTier(index, { name: e.target.value })
                            }
                            placeholder="e.g., Early Bird, Regular, VIP"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-price-${index}`}>
                            Price (USD)
                          </Label>
                          <Input
                            id={`tier-price-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.price / 100}
                            onChange={(e) =>
                              updatePricingTier(index, {
                                price: Math.round(parseFloat(e.target.value) * 100),
                              })
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`tier-description-${index}`}>
                          Description
                        </Label>
                        <Textarea
                          id={`tier-description-${index}`}
                          value={tier.description || ""}
                          onChange={(e) =>
                            updatePricingTier(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Describe what's included in this tier"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tier-available-until-${index}`}>
                            Available Until (Optional)
                          </Label>
                          <Input
                            id={`tier-available-until-${index}`}
                            type="datetime-local"
                            value={
                              tier.available_until
                                ? new Date(tier.available_until)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              updatePricingTier(index, {
                                available_until: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : undefined,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-max-quantity-${index}`}>
                            Max Quantity (Optional)
                          </Label>
                          <Input
                            id={`tier-max-quantity-${index}`}
                            type="number"
                            min="1"
                            value={tier.max_quantity || ""}
                            onChange={(e) =>
                              updatePricingTier(index, {
                                max_quantity: e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined,
                              })
                            }
                            placeholder="Unlimited"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`tier-stripe-id-${index}`}>
                          Stripe Price ID (Optional)
                        </Label>
                        <Input
                          id={`tier-stripe-id-${index}`}
                          value={tier.stripe_price_id || ""}
                          onChange={(e) =>
                            updatePricingTier(index, {
                              stripe_price_id: e.target.value || undefined,
                            })
                          }
                          placeholder="price_1234567890abcdef"
                        />
                        <p className="text-xs text-gray-500">
                          Create a Stripe price in your dashboard and paste the ID here
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button
              onClick={addPricingTier}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Pricing Tier
            </Button>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
      >
        {saving ? "Saving..." : "Save Pricing Configuration"}
      </Button>
    </div>
  );
}