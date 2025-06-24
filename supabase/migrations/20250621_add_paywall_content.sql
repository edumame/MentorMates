-- Add paywall_content column to events table
ALTER TABLE "public"."events" 
ADD COLUMN "paywall_content" text;

-- Add comment for the new column
COMMENT ON COLUMN "public"."events"."paywall_content" IS 'Content that is only accessible to users who have joined/paid for the event'; 