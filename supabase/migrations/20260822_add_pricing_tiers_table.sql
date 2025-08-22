-- Create pricing_tiers table with event_id foreign key
-- Replace JSONB pricing_tiers column with normalized table structure

-- Create the pricing_tiers table
CREATE TABLE "public"."pricing_tiers" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "event_id" uuid NOT NULL REFERENCES "public"."events"("event_id") ON DELETE CASCADE,
    "tier_id" text NOT NULL, -- Unique identifier within the event (e.g., "early-bird", "regular")
    "name" text NOT NULL,
    "price" integer NOT NULL, -- Price in cents
    "stripe_price_id" text,
    "description" text,
    "available_until" timestamptz,
    "max_quantity" integer,
    "current_quantity" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    "bundle_size" integer DEFAULT 1,
    
    -- Ensure tier_id is unique within each event
    CONSTRAINT "pricing_tiers_event_tier_unique" UNIQUE ("event_id", "tier_id")
);

-- Add table ownership
ALTER TABLE "public"."pricing_tiers" OWNER TO "postgres";

-- Add comments for documentation
COMMENT ON TABLE "public"."pricing_tiers" IS 'Pricing tiers for events with multiple pricing options';
COMMENT ON COLUMN "public"."pricing_tiers"."tier_id" IS 'Unique identifier for the tier within the event (e.g., early-bird, regular, student)';
COMMENT ON COLUMN "public"."pricing_tiers"."name" IS 'Display name for the pricing tier';
COMMENT ON COLUMN "public"."pricing_tiers"."price" IS 'Price in cents for this tier';
COMMENT ON COLUMN "public"."pricing_tiers"."stripe_price_id" IS 'Stripe price ID for this tier';
COMMENT ON COLUMN "public"."pricing_tiers"."description" IS 'Description of what this tier includes';
COMMENT ON COLUMN "public"."pricing_tiers"."available_until" IS 'Optional deadline for when this tier is available';
COMMENT ON COLUMN "public"."pricing_tiers"."max_quantity" IS 'Optional maximum number of tickets for this tier';
COMMENT ON COLUMN "public"."pricing_tiers"."current_quantity" IS 'Current number of tickets sold for this tier';
COMMENT ON COLUMN "public"."pricing_tiers"."sort_order" IS 'Order in which tiers should be displayed';
COMMENT ON COLUMN "public"."pricing_tiers"."bundle_size" IS 'Number of tickets in a bundle';

-- Create indexes for performance
CREATE INDEX "pricing_tiers_event_id_idx" ON "public"."pricing_tiers" ("event_id");
CREATE INDEX "pricing_tiers_active_idx" ON "public"."pricing_tiers" ("is_active");
CREATE INDEX "pricing_tiers_sort_order_idx" ON "public"."pricing_tiers" ("event_id", "sort_order");
CREATE INDEX "pricing_tiers_available_until_idx" ON "public"."pricing_tiers" ("available_until");
CREATE INDEX "pricing_tiers_bundle_size_idx" ON "public"."pricing_tiers" ("bundle_size");

-- Add trigger for updated_at
CREATE TRIGGER "update_pricing_tiers_updated_at"
    BEFORE UPDATE ON "public"."pricing_tiers"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Update user_event_payments to reference pricing_tier instead of pricing_tier_id text
ALTER TABLE "public"."user_event_payments" 
ADD COLUMN "pricing_tier_uuid" uuid REFERENCES "public"."pricing_tiers"("id") ON DELETE SET NULL;

-- Add index for the new foreign key
CREATE INDEX "user_event_payments_pricing_tier_uuid_idx" ON "public"."user_event_payments" ("pricing_tier_uuid");

-- Add index for the new foreign key
CREATE INDEX "event_tickets_pricing_tier_uuid_idx" ON "public"."event_tickets" ("pricing_tier_uuid");

-- Add constraint to ensure paid events have at least one pricing tier
ALTER TABLE "public"."events" 
ADD CONSTRAINT "check_if_paid_then_has_pricing_tiers" 
CHECK (
  "paid" = false OR 
  EXISTS (
    SELECT 1 FROM "public"."pricing_tiers" 
    WHERE "pricing_tiers"."event_id" = "events"."event_id" 
    AND "pricing_tiers"."is_active" = true
  )
);

-- Enable RLS on pricing_tiers table
ALTER TABLE "public"."pricing_tiers" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view active pricing tiers for visible events
CREATE POLICY "Anyone can view active pricing tiers for visible events"
ON "public"."pricing_tiers" FOR SELECT
TO public
USING (
  "is_active" = true AND
  EXISTS (
    SELECT 1 FROM "public"."events" 
    WHERE "events"."event_id" = "pricing_tiers"."event_id" 
    AND "events"."visibility" IN ('public', 'unlisted')
  )
);

-- RLS Policy: Organizers and admins can manage pricing tiers for their events
CREATE POLICY "Organizers can manage pricing tiers for their events"
ON "public"."pricing_tiers"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."user_event_roles" uer
    WHERE uer."user_id" = auth.uid()
    AND uer."event_id" = "pricing_tiers"."event_id"
    AND uer."role" IN ('organizer', 'admin')
  )
);