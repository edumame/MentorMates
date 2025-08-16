-- Add support for multiple pricing tiers
-- Replace single price with pricing tiers structure

-- First, add the new pricing_tiers column
ALTER TABLE "public"."events" 
ADD COLUMN "pricing_tiers" jsonb DEFAULT '[]'::jsonb;

-- Add comment for the new column
COMMENT ON COLUMN "public"."events"."pricing_tiers" IS 'Array of pricing tiers with name, price, stripe_price_id, and description. Example:
[
  {
    "id": "early-bird",
    "name": "Early Bird",
    "price": 2500,
    "stripe_price_id": "price_1234",
    "description": "Limited time early access pricing",
    "available_until": "2024-12-01T00:00:00Z",
    "max_quantity": 100
  },
  {
    "id": "regular",
    "name": "Regular",
    "price": 5000,
    "stripe_price_id": "price_5678",
    "description": "Standard event pricing"
  }
]';

-- Add index for pricing tiers queries
CREATE INDEX "events_pricing_tiers_idx" ON "public"."events" USING GIN ("pricing_tiers");

-- Update the constraint to work with pricing tiers
-- Remove old constraints first
ALTER TABLE "public"."events" 
DROP CONSTRAINT IF EXISTS check_if_paid_then_stripe,
DROP CONSTRAINT IF EXISTS check_if_paid_then_price;

-- Add new constraint for pricing tiers
ALTER TABLE "public"."events" 
ADD CONSTRAINT check_if_paid_then_pricing_tiers 
CHECK (
  paid = false OR 
  (pricing_tiers IS NOT NULL AND jsonb_array_length(pricing_tiers) > 0)
);

-- Add pricing tier information to user_event_payments table
ALTER TABLE "public"."user_event_payments" 
ADD COLUMN "pricing_tier_id" text,
ADD COLUMN "pricing_tier_name" text;

COMMENT ON COLUMN "public"."user_event_payments"."pricing_tier_id" IS 'ID of the pricing tier selected by the user';
COMMENT ON COLUMN "public"."user_event_payments"."pricing_tier_name" IS 'Name of the pricing tier selected by the user';