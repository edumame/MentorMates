-- Add pricing columns to events table
ALTER TABLE "public"."events" 
ADD COLUMN "paid" boolean DEFAULT false,
ADD COLUMN "stripe_price_id" text;

-- Add comments for the new columns
COMMENT ON COLUMN "public"."events"."paid" IS 'Event is paid';
COMMENT ON COLUMN "public"."events"."stripe_price_id" IS 'Stripe price ID for paid events';

-- Add index for price queries
CREATE INDEX "events_paid_idx" ON "public"."events" ("paid"); 