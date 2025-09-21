"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Tag, Copy, Check } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { Coupon, PromoCode } from "@/lib/types";

interface PromoCodeManagementProps {
  eventId: string;
  coupons: Coupon[];
  onPromoCodeChange?: () => void;
}

export interface CreatePromoCodeRequest {
    promoCode: string;
    couponId: string;
    overwrite?: boolean;
  }

export function PromoCodeManagement({ 
  eventId, 
  coupons, 
  onPromoCodeChange 
}: PromoCodeManagementProps) {
  const [promoCodes, setPromoCodes] = useState<(PromoCode & { coupon_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const [newPromoCode, setNewPromoCode] = useState<CreatePromoCodeRequest>({
    promoCode: "",
    couponId: "",
    overwrite: false,
  });

  const fetchPromoCodes = useCallback(async () => {
    try {
      const response = await fetch(`/api/stripe/coupon/promo?eventId=${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch promo codes");
      }
      const data = await response.json();
      
      setPromoCodes(data.promoCodes || []);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      toast({
        title: "Error",
        description: "Failed to load promo codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  // Fetch promo codes for all event coupons
  useEffect(() => {
    fetchPromoCodes();
  }, [eventId, fetchPromoCodes]);

  const handleCreatePromoCode = async () => {
    if (!newPromoCode.promoCode.trim()) {
      toast({
        title: "Error",
        description: "Promo code is required",
        variant: "destructive",
      });
      return;
    }

    if (!newPromoCode.couponId) {
      toast({
        title: "Error",
        description: "Please select a coupon",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/stripe/coupon/promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPromoCode),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create promo code");
      }

      toast({
        title: "Success",
        description: "Promo code created successfully",
      });

      // Reset form and refresh list
      setNewPromoCode({
        promoCode: "",
        couponId: "",
        overwrite: false,
      });
      setShowCreateForm(false);
      fetchPromoCodes();
      onPromoCodeChange?.();
    } catch (error) {
      console.error("Error creating promo code:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create promo code",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePromoCode = async (promoCode: string) => {
    if (!confirm("Are you sure you want to delete this promo code? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/stripe/coupon/promo", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promoCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete promo code");
      }

      toast({
        title: "Success",
        description: "Promo code deleted successfully",
      });

      fetchPromoCodes();
      onPromoCodeChange?.();
    } catch (error) {
      console.error("Error deleting promo code:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete promo code",
        variant: "destructive",
      });
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "Copied!",
        description: "Promo code copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy promo code",
        variant: "destructive",
      });
    }
  };

  const generateRandomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setNewPromoCode({ ...newPromoCode, promoCode: result });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Promo Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Loading promo codes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Promo Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create New Promo Code Form */}
        {showCreateForm && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Create New Promo Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-select">Select Coupon *</Label>
                <Select
                  value={newPromoCode.couponId}
                  onValueChange={(value) =>
                    setNewPromoCode({ ...newPromoCode, couponId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a coupon..." />
                  </SelectTrigger>
                  <SelectContent>
                    {coupons.map((coupon) => (
                      <SelectItem key={coupon.id} value={coupon.id}>
                        {coupon.name} - {coupon.percent_off ? `${coupon.percent_off}% off` : 
                          coupon.amount_off ? `$${(coupon.amount_off / 100).toFixed(2)} off` : 'Discount'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {coupons.length === 0 && (
                  <p className="text-sm text-gray-500">
                    You need to create a coupon first before adding promo codes.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-code">Promo Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    value={newPromoCode.promoCode}
                    onChange={(e) =>
                      setNewPromoCode({ 
                        ...newPromoCode, 
                        promoCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') 
                      })
                    }
                    placeholder="e.g., EARLYBIRD2024"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomCode}
                    className="px-3"
                  >
                    Random
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Use letters and numbers only. Code will be converted to uppercase.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={newPromoCode.overwrite}
                  onCheckedChange={(checked) =>
                    setNewPromoCode({ 
                      ...newPromoCode, 
                      overwrite: checked === true 
                    })
                  }
                />
                <Label htmlFor="overwrite" className="text-sm">
                  Overwrite existing promo code if it exists
                </Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleCreatePromoCode} 
                  disabled={creating || coupons.length === 0}
                >
                  {creating ? "Creating..." : "Create Promo Code"}
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

        {/* Existing Promo Codes */}
        {promoCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No promo codes created yet</p>
            <p className="text-sm">
              {coupons.length === 0 
                ? "Create a coupon first, then add promo codes"
                : "Create your first promo code for easier sharing"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {promoCodes.map((promoCode) => (
              <Card key={promoCode.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                          {promoCode.code}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyCode(promoCode.code)}
                          className="h-8 w-8 p-0"
                        >
                          {copiedCode === promoCode.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Coupon: {promoCode.coupon_name}</div>
                        <div>Used: {promoCode.usage_count} times</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={promoCode.is_active ? "default" : "secondary"}
                      >
                        {promoCode.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePromoCode(promoCode.code)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {promoCode.max_uses && (
                    <div className="mt-2 text-xs text-gray-500">
                      Max uses: {promoCode.max_uses}
                      {promoCode.usage_count >= promoCode.max_uses && (
                        <span className="text-red-600 ml-2">• Limit reached</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Promo Code Button */}
        {!showCreateForm && (
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="outline"
            className="w-full"
            disabled={coupons.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Promo Code
          </Button>
        )}

        {coupons.length === 0 && (
          <div className="text-center text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
            💡 Tip: Create coupons first in the section above, then add specific promo codes here for easier sharing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
