-- Migrate existing single-price events to pricing tiers format
-- This migration converts events with the old price/stripe_price_id fields to the new pricing_tiers structure

UPDATE "public"."events" 
SET "pricing_tiers" = jsonb_build_array(
  jsonb_build_object(
    'id', 'default',
    'name', 'Standard',
    'price', COALESCE(price, 0),
    'stripe_price_id', stripe_price_id,
    'description', 'Standard event pricing'
  )
)
WHERE paid = true 
  AND (price IS NOT NULL OR stripe_price_id IS NOT NULL)
  AND (pricing_tiers IS NULL OR jsonb_array_length(pricing_tiers) = 0);