-- Create coupons table to track Stripe coupons associated with events
-- This table connects event_ids to Stripe coupon/promo codes

-- Create enum for coupon status
CREATE TYPE coupon_status_enum AS ENUM ('active', 'inactive', 'expired');

-- Create the coupons table
CREATE TABLE "public"."coupons" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "event_id" uuid NOT NULL REFERENCES "public"."events"("event_id") ON DELETE CASCADE,
    "stripe_coupon_id" text NOT NULL UNIQUE, -- Stripe coupon ID
    "name" text NOT NULL, -- Display name for the coupon
    "codes" text[], -- Optional promo codes for manual entry
    "percent_off" integer, -- Percentage discount (e.g., 25 for 25%)
    "amount_off" integer, -- Fixed amount discount in cents
    "currency" text, -- Currency for amount_off (e.g., 'usd')
    "duration" text NOT NULL, -- 'once', 'repeating', or 'forever'
    "duration_in_months" integer, -- For 'repeating' duration
    "max_redemptions" integer, -- Maximum number of times this coupon can be used
    "redeem_by" timestamptz, -- Expiration date
    "created_by_user_id" uuid REFERENCES "public"."user_profiles"("uid") ON DELETE SET NULL,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    
    -- Ensure either percent_off or amount_off is provided, but not both
    CONSTRAINT "coupons_discount_check" CHECK (
        (percent_off IS NOT NULL AND amount_off IS NULL) OR
        (percent_off IS NULL AND amount_off IS NOT NULL)
    ),
    
    -- Ensure percent_off is between 1 and 100
    CONSTRAINT "coupons_percent_range" CHECK (
        percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)
    ),
    
    -- Ensure amount_off is positive
    CONSTRAINT "coupons_amount_positive" CHECK (
        amount_off IS NULL OR amount_off > 0
    ),
    
    -- Ensure currency is provided when amount_off is used
    CONSTRAINT "coupons_currency_required" CHECK (
        amount_off IS NULL OR currency IS NOT NULL
    ),
    
    -- Ensure duration_in_months is provided when duration is 'repeating'
    CONSTRAINT "coupons_duration_months" CHECK (
        duration != 'repeating' OR duration_in_months IS NOT NULL
    )
);

-- Add table ownership
ALTER TABLE "public"."coupons" OWNER TO "postgres";

-- Add comments for documentation
COMMENT ON TABLE "public"."coupons" IS 'Event-specific coupons and promo codes managed through Stripe';
COMMENT ON COLUMN "public"."coupons"."stripe_coupon_id" IS 'Unique Stripe coupon identifier';
COMMENT ON COLUMN "public"."coupons"."name" IS 'Human-readable name for the coupon';
COMMENT ON COLUMN "public"."coupons"."codes" IS 'Optional array of promo codes for user entry (if different from Stripe ID)';
COMMENT ON COLUMN "public"."coupons"."percent_off" IS 'Percentage discount (1-100), mutually exclusive with amount_off';
COMMENT ON COLUMN "public"."coupons"."amount_off" IS 'Fixed discount amount in cents, mutually exclusive with percent_off';
COMMENT ON COLUMN "public"."coupons"."currency" IS 'Currency code for amount_off discounts (e.g., usd, eur)';
COMMENT ON COLUMN "public"."coupons"."duration" IS 'How long the discount applies: once, repeating, or forever';
COMMENT ON COLUMN "public"."coupons"."duration_in_months" IS 'Number of months for repeating coupons';
COMMENT ON COLUMN "public"."coupons"."max_redemptions" IS 'Maximum number of times this coupon can be used across all users';
COMMENT ON COLUMN "public"."coupons"."redeem_by" IS 'Expiration timestamp for the coupon';

-- Create indexes for performance
CREATE INDEX "coupons_event_id_idx" ON "public"."coupons" ("event_id");
CREATE INDEX "coupons_stripe_coupon_id_idx" ON "public"."coupons" ("stripe_coupon_id");
CREATE INDEX "coupons_codes_idx" ON "public"."coupons" USING GIN ("codes") WHERE "codes" IS NOT NULL;
CREATE INDEX "coupons_status_idx" ON "public"."coupons" ("status");
CREATE INDEX "coupons_redeem_by_idx" ON "public"."coupons" ("redeem_by") WHERE "redeem_by" IS NOT NULL;
CREATE INDEX "coupons_created_by_idx" ON "public"."coupons" ("created_by_user_id");

-- Add trigger for updated_at
CREATE TRIGGER "update_coupons_updated_at"
    BEFORE UPDATE ON "public"."coupons"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Create function to automatically update coupon status based on expiration
CREATE OR REPLACE FUNCTION update_expired_coupons()
RETURNS void AS $$
BEGIN
    UPDATE "public"."coupons"
    SET "status" = 'expired'
    WHERE "status" = 'active'
    AND "redeem_by" IS NOT NULL
    AND "redeem_by" < now();
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for coupons
ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can manage all coupons
CREATE POLICY "Admin users can manage coupons" ON "public"."coupons"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "public"."user_profiles" up
            WHERE up."uid" = auth.uid()
            AND up."role" = 'admin'
        )
    );

-- Policy: Event organizers can manage coupons for their events
CREATE POLICY "Event organizers can manage their event coupons" ON "public"."coupons"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "public"."user_event_roles" uer
            WHERE uer."user_id" = auth.uid()
            AND uer."event_id" = "coupons"."event_id"
            AND uer."role" = 'organizer'
        )
    );

-- Policy: Users can view active coupons for events they have access to
CREATE POLICY "Users can view active coupons for accessible events" ON "public"."coupons"
    FOR SELECT USING (
        "status" = 'active'
        AND EXISTS (
            SELECT 1 FROM "public"."events" e
            WHERE e."event_id" = "coupons"."event_id"
            AND (
                e."visibility" = 'public'
                OR EXISTS (
                    SELECT 1 FROM "public"."user_event_roles" uer
                    WHERE uer."user_id" = auth.uid()
                    AND uer."event_id" = e."event_id"
                )
            )
        )
    );
