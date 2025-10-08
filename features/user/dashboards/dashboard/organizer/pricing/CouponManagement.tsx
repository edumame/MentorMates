"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Percent, DollarSign, Calendar, Users } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { Coupon, CouponWithCodes, CreateCouponRequest, CouponDuration } from "@/lib/types";

interface CouponManagementProps {
  eventId: string;
  onCouponsChange?: () => void;
}

export function CouponManagement({ eventId, onCouponsChange }: CouponManagementProps) {
  const [coupons, setCoupons] = useState<CouponWithCodes[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();

  const [newCoupon, setNewCoupon] = useState<CreateCouponRequest>({
    couponName: "",
    eventId,
    duration: "once",
  });

  // Fetch coupons for the event
  useEffect(() => {
    fetchCoupons();
  }, [eventId]);

  const fetchCoupons = async () => {
    try {
      const response = await fetch(`/api/stripe/coupon?eventId=${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch coupons");
      }
      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast({
        title: "Error",
        description: "Failed to load coupons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.couponName) {
      toast({
        title: "Error",
        description: "Coupon name is required",
        variant: "destructive",
      });
      return;
    }

    if (!newCoupon.percent_off && !newCoupon.amount_off) {
      toast({
        title: "Error",
        description: "Either percentage or fixed amount discount is required",
        variant: "destructive",
      });
      return;
    }

    if (newCoupon.amount_off && !newCoupon.currency) {
      toast({
        title: "Error",
        description: "Currency is required for fixed amount discounts",
        variant: "destructive",
      });
      return;
    }

    if (newCoupon.duration === "repeating" && !newCoupon.duration_in_months) {
      toast({
        title: "Error",
        description: "Duration in months is required for repeating coupons",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/stripe/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCoupon),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create coupon");
      }

      toast({
        title: "Success",
        description: "Coupon created successfully",
      });

      // Reset form and refresh list
      setNewCoupon({
        couponName: "",
        eventId,
        duration: "once",
      });
      setShowCreateForm(false);
      fetchCoupons();
      onCouponsChange?.();
    } catch (error) {
      console.error("Error creating coupon:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create coupon",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("Are you sure you want to delete this coupon? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/stripe/coupon", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ couponId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete coupon");
      }

      toast({
        title: "Success",
        description: "Coupon deleted successfully",
      });

      fetchCoupons();
      onCouponsChange?.();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete coupon",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amountInCents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountInCents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCouponDisplayValue = (coupon: Coupon) => {
    if (coupon.percent_off) {
      return `${coupon.percent_off}% off`;
    }
    if (coupon.amount_off && coupon.currency) {
      return `${formatCurrency(coupon.amount_off, coupon.currency)} off`;
    }
    return "Unknown discount";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "expired":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Coupons & Discounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Percent className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Loading coupons...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Coupons & Discounts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create New Coupon Form */}
        {showCreateForm && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Create New Coupon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coupon-name">Coupon Name *</Label>
                  <Input
                    id="coupon-name"
                    value={newCoupon.couponName}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, couponName: e.target.value })
                    }
                    placeholder="e.g., Early Bird Special"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration *</Label>
                  <Select
                    value={newCoupon.duration}
                    onValueChange={(value: CouponDuration) =>
                      setNewCoupon({ ...newCoupon, duration: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">One-time use</SelectItem>
                      <SelectItem value="forever">Forever</SelectItem>
                      <SelectItem value="repeating">Repeating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newCoupon.duration === "repeating" && (
                <div className="space-y-2">
                  <Label htmlFor="duration-months">Duration (Months)</Label>
                  <Input
                    id="duration-months"
                    type="number"
                    min="1"
                    value={newCoupon.duration_in_months || ""}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        duration_in_months: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="Number of months"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="percent-off">Percentage Off (%)</Label>
                  <Input
                    id="percent-off"
                    type="number"
                    min="1"
                    max="100"
                    value={newCoupon.percent_off || ""}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        percent_off: parseInt(e.target.value) || undefined,
                        amount_off: undefined, // Clear amount_off when setting percent_off
                      })
                    }
                    placeholder="e.g., 25"
                    disabled={!!newCoupon.amount_off}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount-off">Fixed Amount Off</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amount-off"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newCoupon.amount_off ? newCoupon.amount_off / 100 : ""}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          amount_off: parseFloat(e.target.value) * 100 || undefined,
                          percent_off: undefined, // Clear percent_off when setting amount_off
                        })
                      }
                      placeholder="e.g., 10.00"
                      disabled={!!newCoupon.percent_off}
                    />
                    <Select
                      value={newCoupon.currency || "usd"}
                      onValueChange={(value) =>
                        setNewCoupon({ ...newCoupon, currency: value })
                      }
                      disabled={!newCoupon.amount_off}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD</SelectItem>
                        <SelectItem value="eur">EUR</SelectItem>
                        <SelectItem value="gbp">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-redemptions">Max Uses (Optional)</Label>
                  <Input
                    id="max-redemptions"
                    type="number"
                    min="1"
                    value={newCoupon.max_redemptions || ""}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        max_redemptions: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redeem-by">Expiration Date (Optional)</Label>
                  <Input
                    id="redeem-by"
                    type="datetime-local"
                    value={newCoupon.redeem_by || ""}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        redeem_by: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateCoupon} disabled={creating}>
                  {creating ? "Creating..." : "Create Coupon"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Coupons */}
        {coupons.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No coupons created yet</p>
            <p className="text-sm">Create your first coupon to offer discounts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <Card key={coupon.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{coupon.name}</CardTitle>
                      <Badge variant={getStatusBadgeVariant(coupon.status)}>
                        {coupon.status}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {coupon.percent_off ? (
                        <Percent className="h-4 w-4 text-green-600" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-green-600" />
                      )}
                      <span className="font-medium">{getCouponDisplayValue(coupon)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>
                        {coupon.max_redemptions ? `${coupon.max_redemptions} uses` : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <span>
                        {coupon.redeem_by ? formatDate(coupon.redeem_by) : "No expiration"}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Duration: {coupon.duration}
                      {coupon.duration_in_months && ` (${coupon.duration_in_months}m)`}
                    </div>
                  </div>
                  {coupon.promo_codes && coupon.promo_codes.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm text-gray-600 mb-2">
                        Promo Codes ({coupon.promo_codes.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {coupon.promo_codes.slice(0, 3).map((code) => (
                          <Badge key={code.id} variant="outline">
                            {code.code} ({code.usage_count} uses)
                          </Badge>
                        ))}
                        {coupon.promo_codes.length > 3 && (
                          <Badge variant="secondary">
                            +{coupon.promo_codes.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Coupon Button */}
        {!showCreateForm && (
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Coupon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
