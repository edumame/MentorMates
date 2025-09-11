"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, DollarSign, Package } from "lucide-react";
import { EventDetails, PricingTier } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";

interface PricingTabProps {
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
}

export function PricingTab({
  event,
  setEvent,
  saving,
  setSaving,
}: PricingTabProps) {
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  // Fetch pricing tiers from the database
  useEffect(() => {
    async function fetchPricingTiers() {
      if (!event.event_id) return;
      
      try {
        const { data, error } = await supabase
          .from("pricing_tiers")
          .select(`
            *
          `)
          .eq("event_id", event.event_id)
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Error fetching pricing tiers:", error);
          toast({
            title: "Error",
            description: "Failed to load pricing tiers",
            variant: "destructive",
          });
        } else {
          setPricingTiers(data || []);
        }
      } catch (error) {
        console.error("Error fetching pricing tiers:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPricingTiers();
  }, [event.event_id, toast]);

  const handlePaidToggle = async (checked: boolean) => {
    setEvent({ ...event, paid: checked });
    
    if (!checked) {
      // When making event free, deactivate all pricing tiers
      setSaving(true);
      try {
        const { error } = await supabase
          .from("pricing_tiers")
          .update({ is_active: false })
          .eq("event_id", event.event_id);

        if (error) throw error;

        // Update local state
        setPricingTiers(prev => prev.map(tier => ({ ...tier, is_active: false })));
        
        // Update event paid status
        const { error: eventError } = await supabase
          .from("events")
          .update({ paid: false })
          .eq("event_id", event.event_id);

        if (eventError) throw eventError;

        toast({
          title: "Success",
          description: "Event set to free and pricing tiers deactivated",
        });
      } catch (error) {
        console.error("Error updating event:", error);
        toast({
          title: "Error",
          description: "Failed to update event pricing",
          variant: "destructive",
        });
        // Revert the UI state on error
        setEvent({ ...event, paid: !checked });
      } finally {
        setSaving(false);
      }
    } else {
      // When making event paid, just update the event
      setSaving(true);
      try {
        const { error } = await supabase
          .from("events")
          .update({ paid: true })
          .eq("event_id", event.event_id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Event set to paid",
        });
      } catch (error) {
        console.error("Error updating event:", error);
        toast({
          title: "Error",
          description: "Failed to update event pricing",
          variant: "destructive",
        });
        // Revert the UI state on error
        setEvent({ ...event, paid: !checked });
      } finally {
        setSaving(false);
      }
    }
  };

  const addPricingTier = async () => {
    const tierId = `tier-${Date.now()}`;
    const newTier: Partial<PricingTier> = {
      event_id: event.event_id,
      tier_id: tierId,
      name: "New Tier",
      price: 0,
      description: "",
      stripe_price_id: "",
      is_active: true,
      sort_order: pricingTiers.length,
    };

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .insert([newTier])
        .select()
        .single();

      if (error) throw error;

      setPricingTiers([...pricingTiers, data]);
      toast({
        title: "Success",
        description: "New pricing tier added",
      });
    } catch (error) {
      console.error("Error adding pricing tier:", error);
      toast({
        title: "Error",
        description: "Failed to add pricing tier",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePricingTier = async (index: number, updates: Partial<PricingTier>) => {
    const tier = pricingTiers[index];
    if (!tier.id) return; // Don't update if tier doesn't have an ID

    // Update local state immediately for better UX
    const updatedTiers = pricingTiers.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );
    setPricingTiers(updatedTiers);

    // Debounce the database update
    try {
      const { error } = await supabase
        .from("pricing_tiers")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tier.id);

      if (error) {
        console.error("Error updating pricing tier:", error);
        // Revert local state on error
        setPricingTiers(pricingTiers);
        toast({
          title: "Error",
          description: "Failed to update pricing tier",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating pricing tier:", error);
      // Revert local state on error
      setPricingTiers(pricingTiers);
    }
  };

  const removePricingTier = async (index: number) => {
    const tier = pricingTiers[index];
    if (!tier.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("pricing_tiers")
        .delete()
        .eq("id", tier.id);

      if (error) throw error;

      const updatedTiers = pricingTiers.filter((_, i) => i !== index);
      setPricingTiers(updatedTiers);
      
      toast({
        title: "Success",
        description: "Pricing tier removed",
      });
    } catch (error) {
      console.error("Error removing pricing tier:", error);
      toast({
        title: "Error",
        description: "Failed to remove pricing tier",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Note: Individual pricing tier changes are now saved automatically
  // This function is kept for any final event-level updates if needed
  const handleSave = async () => {
    setSaving(true);
    try {
      // Just update the event's paid status if needed
      const { error } = await supabase
        .from("events")
        .update({
          paid: event.paid,
        })
        .eq("event_id", event.event_id);

      if (error) throw error;

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
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
                <p>Loading pricing tiers...</p>
              </div>
            ) : pricingTiers.filter(tier => tier.is_active !== false).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pricing tiers configured</p>
                <p className="text-sm">Add your first pricing tier to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pricingTiers.filter(tier => tier.is_active !== false).map((tier, displayIndex) => {
                  // Find the actual index in the original array
                  const actualIndex = pricingTiers.findIndex(t => t.id === tier.id);
                  return (
                    <Card key={tier.id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            Tier {displayIndex + 1}
                          </CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePricingTier(actualIndex)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tier-name-${actualIndex}`}>Tier Name</Label>
                          <Input
                            id={`tier-name-${actualIndex}`}
                            value={tier.name}
                            onChange={(e) =>
                              updatePricingTier(actualIndex, { name: e.target.value })
                            }
                            placeholder="e.g., Early Bird, Regular, VIP"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-price-${actualIndex}`}>
                            Price (USD)
                          </Label>
                          <Input
                            id={`tier-price-${actualIndex}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.price / 100}
                            onChange={(e) =>
                              updatePricingTier(actualIndex, {
                                price: Math.round(parseFloat(e.target.value) * 100),
                              })
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`tier-description-${actualIndex}`}>
                          Description
                        </Label>
                        <Textarea
                          id={`tier-description-${actualIndex}`}
                          value={tier.description || ""}
                          onChange={(e) =>
                            updatePricingTier(actualIndex, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Describe what's included in this tier"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tier-available-until-${actualIndex}`}>
                            Available Until (Optional)
                          </Label>
                          <Input
                            id={`tier-available-until-${actualIndex}`}
                            type="datetime-local"
                            value={
                              tier.available_until
                                ? new Date(tier.available_until)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              updatePricingTier(actualIndex, {
                                available_until: e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : undefined,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-max-quantity-${actualIndex}`}>
                            Max Quantity (Optional)
                          </Label>
                          <Input
                            id={`tier-max-quantity-${actualIndex}`}
                            type="number"
                            min="1"
                            value={tier.max_quantity || ""}
                            onChange={(e) =>
                              updatePricingTier(actualIndex, {
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
                        <Label htmlFor={`tier-stripe-id-${actualIndex}`}>
                          Stripe Price ID (Optional)
                        </Label>
                        <Input
                          id={`tier-stripe-id-${actualIndex}`}
                          value={tier.stripe_price_id || ""}
                          onChange={(e) =>
                            updatePricingTier(actualIndex, {
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
                  );
                })}
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