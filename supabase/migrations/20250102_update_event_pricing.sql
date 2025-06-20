-- Update events table to use boolean paid field instead of price
ALTER TABLE "public"."events" 
DROP COLUMN IF EXISTS "price",
ADD COLUMN "paid" boolean DEFAULT false;

-- Add comment for the new column
COMMENT ON COLUMN "public"."events"."paid" IS 'Whether the event requires payment to join';

-- Add index for paid events queries
CREATE INDEX "events_paid_idx" ON "public"."events" ("paid"); 