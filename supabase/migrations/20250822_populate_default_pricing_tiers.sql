-- Migration to populate pricing_tiers table with default pricing tiers
-- for events that have stripe_price_id and price values
-- This should run after 20250822_add_pricing_tiers_table.sql

-- Insert default pricing tiers for events with existing stripe_price_id
INSERT INTO "public"."pricing_tiers" (
    "event_id",
    "tier_id", 
    "name",
    "price",
    "stripe_price_id",
    "description",
    "is_active",
    "sort_order",
    "bundle_size"
)
SELECT 
    e."event_id",
    'default' as "tier_id",
    'General Admission' as "name",
    COALESCE(e."price", 0) as "price", -- Use event price or default to 0
    e."stripe_price_id",
    'Standard event ticket' as "description",
    true as "is_active",
    0 as "sort_order",
    1 as "bundle_size"
FROM "public"."events" e
WHERE e."stripe_price_id" IS NOT NULL
AND e."paid" = true
AND NOT EXISTS (
    -- Only insert if no pricing tier already exists for this event
    SELECT 1 FROM "public"."pricing_tiers" pt 
    WHERE pt."event_id" = e."event_id"
);

-- Add comment about the migration
COMMENT ON TABLE "public"."pricing_tiers" IS 'Pricing tiers for events with multiple pricing options. Default tiers migrated from events.stripe_price_id';

-- Update any existing user_event_payments to reference the new pricing tiers
-- This links payments to the newly created default pricing tiers
UPDATE "public"."user_event_payments" uep
SET "pricing_id" = pt."id"
FROM "public"."pricing_tiers" pt
WHERE pt."event_id" = uep."event_id"
AND pt."tier_id" = 'default'
AND uep."pricing_id" IS NULL;

-- Log the migration results
DO $$
DECLARE
    tier_count integer;
    payment_count integer;
BEGIN
    SELECT COUNT(*) INTO tier_count FROM "public"."pricing_tiers" WHERE "tier_id" = 'default';
    SELECT COUNT(*) INTO payment_count FROM "public"."user_event_payments" WHERE "pricing_id" IS NOT NULL;
    
    RAISE NOTICE 'Migration completed: Created % default pricing tiers and linked % payments', tier_count, payment_count;
END $$;