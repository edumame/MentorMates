"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Delete, Add, AttachMoney, Inventory } from "@mui/icons-material";
import { EventDetails, PricingTier, Coupon } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { CouponManagement } from "./CouponManagement";
import { PromoCodeManagement } from "./PromoCodeManagement";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DEFAULT_PAYMENT_CURRENCY,
  PAYMENT_CURRENCY_OPTIONS,
} from "@/lib/utils/pricing";

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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalPricingTiers, setOriginalPricingTiers] = useState<PricingTier[]>([]);
  const { isArchived } = useEventArchiveStatus(event);

  const { toast } = useToast();

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    const newTiers = pricingTiers.filter(tier => tier.id.startsWith('temp-'));
    const deletedTiers = pricingTiers.filter(tier => tier._markedForDeletion);
    const modifiedTiers = pricingTiers.filter(tier => {
      if (tier.id.startsWith('temp-') || tier._markedForDeletion) return false;
      const original = originalPricingTiers.find(orig => orig.id === tier.id);
      if (!original) return false;
      return JSON.stringify(original) !== JSON.stringify({...tier, _markedForDeletion: undefined});
    });
    
    return newTiers.length > 0 || deletedTiers.length > 0 || modifiedTiers.length > 0;
  };

  // Fetch pricing tiers and coupons from the database
  useEffect(() => {
    async function fetchData() {
      if (!event.event_id) return;

      try {
        // Fetch pricing tiers
        const { data: tiersData, error: tiersError } = await supabase
          .from("pricing_tiers")
          .select(
            `
            *
          `
          )
          .eq("event_id", event.event_id)
          .order("sort_order", { ascending: true });

        if (tiersError) {
          console.error("Error fetching pricing tiers:", tiersError);
          toast({
            title: "Error",
            description: "Failed to load pricing tiers",
            variant: "destructive",
          });
          } else {
            setPricingTiers(tiersData || []);
            setOriginalPricingTiers(tiersData || []);
          }

        // Fetch coupons
        const { data: couponsData, error: couponsError } = await supabase
          .from("coupons")
          .select("*")
          .eq("event_id", event.event_id)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (couponsError) {
          console.error("Error fetching coupons:", couponsError);
        } else {
          setCoupons(couponsData || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [event.event_id, toast]);

  // Function to refresh coupons when they change
  const handleCouponsChange = async () => {
    try {
      const { data: couponsData, error: couponsError } = await supabase
        .from("coupons")
        .select("*")
        .eq("event_id", event.event_id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!couponsError) {
        setCoupons(couponsData || []);
      }
    } catch (error) {
      console.error("Error refreshing coupons:", error);
    }
  };

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
        setPricingTiers((prev) =>
          prev.map((tier) => ({ ...tier, is_active: false }))
        );

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

  const addPricingTier = () => {
    const tierId = `tier-${Date.now()}`;
    const newTier: PricingTier = {
      id: `temp-${Date.now()}`, // Temporary ID for local state
      event_id: event.event_id,
      tier_id: tierId,
      name: "New Tier",
      price: 0,
      currency: DEFAULT_PAYMENT_CURRENCY,
      description: "",
      stripe_price_id: "price_", // Provide a placeholder that users must complete
      is_active: true,
      sort_order: pricingTiers.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _markedForDeletion: false,
    };

    setPricingTiers([...pricingTiers, newTier]);
    toast({
      title: "Tier Added",
      description: "New pricing tier added. Remember to save your changes.",
    });
  };

  const updatePricingTier = (index: number, updates: Partial<PricingTier>) => {
    // Update local state only - no database save until handleSave is called
    const updatedTiers = pricingTiers.map((t, i) =>
      i === index ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    );
    setPricingTiers(updatedTiers);
  };

  const removePricingTier = (index: number) => {
    const tier = pricingTiers[index];
    
    // Mark tier for deletion if it exists in database, otherwise just remove from local state
    if (tier.id.startsWith('temp-')) {
      // New tier that hasn't been saved yet - just remove from local state
      const updatedTiers = pricingTiers.filter((_, i) => i !== index);
      setPricingTiers(updatedTiers);
    } else {
      // Existing tier - mark as deleted but keep in local state for save operation
      const updatedTiers = pricingTiers.map((t, i) =>
        i === index ? { ...t, is_active: false, _markedForDeletion: true } : t
      );
      setPricingTiers(updatedTiers);
    }
    
    toast({
      title: "Tier Removed",
      description: "Pricing tier will be removed when you save changes.",
    });
  };

  const handleSave = async () => {
    // Validate that all active pricing tiers have required stripe_price_id if event is paid
    if (event.paid && pricingTiers.length > 0) {
      const activeTiers = pricingTiers.filter(tier => 
        tier.is_active !== false && !tier._markedForDeletion
      );
      const invalidTiers = activeTiers.filter(tier => 
        !tier.stripe_price_id || tier.stripe_price_id.trim() === "" || tier.stripe_price_id === "price_"
      );
      
      if (invalidTiers.length > 0) {
        toast({
          title: "Validation Error",
          description: "All active pricing tiers must have a complete Stripe Price ID",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      // Separate tiers by operation type
      const newTiers = pricingTiers.filter(tier => tier.id.startsWith('temp-'));
      const existingTiers = pricingTiers.filter(tier => !tier.id.startsWith('temp-') && !tier._markedForDeletion);
      const tiersToDelete = pricingTiers.filter(tier => tier._markedForDeletion);

      // Insert new tiers
      if (newTiers.length > 0) {
        const tiersToInsert = newTiers.map(tier => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, _markedForDeletion, ...tierData } = tier;
          return {
            ...tierData,
            currency: tierData.currency || DEFAULT_PAYMENT_CURRENCY,
          };
        });

        const { error: insertError } = await supabase
          .from("pricing_tiers")
          .insert(tiersToInsert);

        if (insertError) throw insertError;
      }

      // Update existing tiers
      for (const tier of existingTiers) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _markedForDeletion, ...tierData } = tier;
        const { error: updateError } = await supabase
          .from("pricing_tiers")
          .update({
            ...tierData,
            currency: tierData.currency || DEFAULT_PAYMENT_CURRENCY,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tier.id);

        if (updateError) throw updateError;
      }

      // Delete marked tiers
      if (tiersToDelete.length > 0) {
        const idsToDelete = tiersToDelete.map(tier => tier.id);
        const { error: deleteError } = await supabase
          .from("pricing_tiers")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) throw deleteError;
      }

      // Update the event's paid status
      const { error: eventError } = await supabase
        .from("events")
        .update({
          paid: event.paid,
        })
        .eq("event_id", event.event_id);

      if (eventError) throw eventError;

      // Refresh pricing tiers from database to get updated IDs and data
      const { data: refreshedTiers, error: fetchError } = await supabase
        .from("pricing_tiers")
        .select("*")
        .eq("event_id", event.event_id)
        .order("sort_order", { ascending: true });

      if (fetchError) throw fetchError;

      setPricingTiers(refreshedTiers || []);
      setOriginalPricingTiers(refreshedTiers || []);

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
            <AttachMoney className="h-5 w-5" />
            Event Pricing
          </CardTitle>
          {isArchived && (
            <div className="mt-2 py-4">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
                <AlertDescription>This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.</AlertDescription>
              </Alert>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="paid-event"
              checked={event.paid || false}
              onCheckedChange={handlePaidToggle}
              disabled={isArchived}
            />
            <Label htmlFor="paid-event">This is a paid event</Label>
          </div>
          <p className="text-sm text-gray-600">
            Toggle this on to set up pricing tiers for your event. Participants
            will need to pay to join.
          </p>
        </CardContent>
      </Card>

      {/* Pricing Tiers Configuration */}
      {event.paid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inventory className="h-5 w-5" />
              Pricing Tiers
            </CardTitle>
            {isArchived && (
              <div className="mt-2 py-4">
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTitle className="text-orange-900">⚠️ Event is Archived</AlertTitle>
                  <AlertDescription>This event is archived and cannot be edited. To make changes, you must first unarchive the event using the controls below.</AlertDescription>
                </Alert>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <Inventory className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
                <p>Loading pricing tiers...</p>
              </div>
             ) : pricingTiers.filter(tier => tier.is_active !== false && !tier._markedForDeletion).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Inventory className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pricing tiers configured</p>
                <p className="text-sm">
                  Add your first pricing tier to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                 {pricingTiers.filter(tier => tier.is_active !== false && !tier._markedForDeletion).map((tier, displayIndex) => {
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
                            disabled={isArchived}
                          >
                            <Delete className="h-4 w-4" />
                          </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,140px)] gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tier-name-${actualIndex}`}>Tier Name</Label>
                          <Input
                            id={`tier-name-${actualIndex}`}
                            value={tier.name}
                            onChange={(e) =>
                              updatePricingTier(actualIndex, { name: e.target.value })
                            }
                            placeholder="e.g., Early Bird, Regular, VIP"
                            disabled={isArchived}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-price-${actualIndex}`}>
                            Price
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
                            disabled={isArchived}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tier-currency-${actualIndex}`}>
                            Currency
                          </Label>
                          <Select
                            value={tier.currency || DEFAULT_PAYMENT_CURRENCY}
                            onValueChange={(value) =>
                              updatePricingTier(actualIndex, { currency: value })
                            }
                            disabled={isArchived}
                          >
                            <SelectTrigger id={`tier-currency-${actualIndex}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_CURRENCY_OPTIONS.map((currency) => (
                                <SelectItem
                                  key={currency.value}
                                  value={currency.value}
                                >
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                              disabled={isArchived}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`tier-available-until-${actualIndex}`}
                              >
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
                                disabled={isArchived}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`tier-max-quantity-${actualIndex}`}
                              >
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
                                disabled={isArchived}
                              />
                            </div>
                          </div>

                      <div className="space-y-2">
                        <Label htmlFor={`tier-stripe-id-${actualIndex}`}>
                          Stripe Price ID <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`tier-stripe-id-${actualIndex}`}
                          value={tier.stripe_price_id || ""}
                          onChange={(e) =>
                            updatePricingTier(actualIndex, {
                              stripe_price_id: e.target.value,
                            })
                          }
                          placeholder="price_1234567890abcdef"
                          required
                          disabled={isArchived}
                        />
                        <p className="text-xs text-gray-500">
                          Create a Stripe price in your dashboard and paste the ID here. Match the display currency above to the Stripe price currency.
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
              <Add className="h-4 w-4 mr-2" />
              Add Pricing Tier
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Coupons & Discounts Section */}
      {event.paid && (
        <>
          <CouponManagement 
            eventId={event.event_id}
            onCouponsChange={handleCouponsChange}
          />
          
          <PromoCodeManagement 
            eventId={event.event_id}
            coupons={coupons}
            onPromoCodeChange={handleCouponsChange}
          />
        </>
      )}

      <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full ${hasUnsavedChanges() ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
        >
          {saving ? "Saving..." : hasUnsavedChanges() ? "Save Changes" : "Save Pricing Configuration"}
        </Button>
        {hasUnsavedChanges() && (
          <p className="text-sm text-orange-600 text-center">
            You have unsaved changes
          </p>
        )}
    </div>
  );
}
