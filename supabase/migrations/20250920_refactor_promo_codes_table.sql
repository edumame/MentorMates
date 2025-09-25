-- Create the promo_codes table
CREATE TABLE "public"."promo_codes" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "coupon_id" uuid NOT NULL REFERENCES "public"."coupons"("id") ON DELETE CASCADE,
    "code" text NOT NULL UNIQUE, -- The actual promo code (e.g., "EARLYBIRD2024")
    "usage_count" integer DEFAULT 0 NOT NULL, -- Number of times this code has been used
    "max_uses" integer, -- Maximum uses for this specific code (NULL = unlimited)
    "is_active" boolean DEFAULT true NOT NULL, -- Whether this code can be used
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    
    -- Ensure usage_count is not negative
    CONSTRAINT "promo_codes_usage_count_positive" CHECK (usage_count >= 0),
    
    -- Ensure max_uses is positive if specified
    CONSTRAINT "promo_codes_max_uses_positive" CHECK (
        max_uses IS NULL OR max_uses > 0
    ),
    
    -- Ensure usage doesn't exceed max_uses
    CONSTRAINT "promo_codes_usage_within_limit" CHECK (
        max_uses IS NULL OR usage_count <= max_uses
    ),
    
    -- Ensure code is not empty
    CONSTRAINT "promo_codes_code_not_empty" CHECK (
        length(trim(code)) > 0
    )
);

-- Add table ownership
ALTER TABLE "public"."promo_codes" OWNER TO "postgres";

-- Add comments for documentation
COMMENT ON TABLE "public"."promo_codes" IS 'Individual promo codes associated with coupons';
COMMENT ON COLUMN "public"."promo_codes"."coupon_id" IS 'Foreign key to the parent coupon';
COMMENT ON COLUMN "public"."promo_codes"."code" IS 'The actual promotional code string users enter';
COMMENT ON COLUMN "public"."promo_codes"."usage_count" IS 'Number of times this specific code has been used';
COMMENT ON COLUMN "public"."promo_codes"."max_uses" IS 'Maximum uses for this code (NULL = unlimited)';
COMMENT ON COLUMN "public"."promo_codes"."is_active" IS 'Whether this code is currently active and can be used';

-- Create indexes for performance
CREATE INDEX "promo_codes_coupon_id_idx" ON "public"."promo_codes" ("coupon_id");
CREATE INDEX "promo_codes_code_idx" ON "public"."promo_codes" ("code");
CREATE INDEX "promo_codes_active_idx" ON "public"."promo_codes" ("is_active") WHERE "is_active" = true;
CREATE INDEX "promo_codes_usage_idx" ON "public"."promo_codes" ("usage_count");

-- Add trigger for updated_at
CREATE TRIGGER "update_promo_codes_updated_at"
    BEFORE UPDATE ON "public"."promo_codes"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Add RLS policies for promo_codes
ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can manage all promo codes
CREATE POLICY "Admin users can manage promo codes" ON "public"."promo_codes"
    FOR ALL USING (
        is_admin_user(auth.uid()) = true
    );

-- Policy: Event organizers can manage promo codes for their event coupons
CREATE POLICY "Event organizers can manage their event promo codes" ON "public"."promo_codes"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "public"."coupons" c
            JOIN "public"."user_event_roles" uer ON uer."event_id" = c."event_id"
            WHERE c."id" = "promo_codes"."coupon_id"
            AND uer."user_id" = auth.uid()
            AND uer."role" = 'organizer'
        )
    );

-- Create a helpful view for joining coupons with their promo codes
CREATE VIEW "public"."coupons_with_codes" AS
SELECT 
    c.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', pc.id,
                'code', pc.code,
                'usage_count', pc.usage_count,
                'max_uses', pc.max_uses,
                'is_active', pc.is_active
            ) ORDER BY pc.created_at
        ) FILTER (WHERE pc.id IS NOT NULL),
        '[]'::json
    ) as promo_codes
FROM "public"."coupons" c
LEFT JOIN "public"."promo_codes" pc ON pc.coupon_id = c.id
GROUP BY c.id;

-- Add comment for the view
COMMENT ON VIEW "public"."coupons_with_codes" IS 'Convenient view showing coupons with their associated promo codes';

-- Create function to increment promo code usage
CREATE OR REPLACE FUNCTION increment_promo_code_usage(promo_code_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    promo_record RECORD;
BEGIN
    -- Get the promo code record with a lock to prevent race conditions
    SELECT pc.*, c.status as coupon_status, c.max_redemptions, c.redeem_by
    INTO promo_record
    FROM "public"."promo_codes" pc
    JOIN "public"."coupons" c ON c.id = pc.coupon_id
    WHERE pc.code = promo_code_text
    AND pc.is_active = true
    AND c.status = 'active'
    FOR UPDATE;
    
    -- Check if promo code exists and is valid
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if coupon has expired
    IF promo_record.redeem_by IS NOT NULL AND promo_record.redeem_by < now() THEN
        RETURN FALSE;
    END IF;
    
    -- Check if promo code has reached its individual limit
    IF promo_record.max_uses IS NOT NULL AND promo_record.usage_count >= promo_record.max_uses THEN
        RETURN FALSE;
    END IF;
    
    -- Check if coupon has reached its global limit
    IF promo_record.max_redemptions IS NOT NULL THEN
        -- Get total usage across all promo codes for this coupon
        DECLARE
            total_usage INTEGER;
        BEGIN
            SELECT COALESCE(SUM(usage_count), 0)
            INTO total_usage
            FROM "public"."promo_codes"
            WHERE coupon_id = promo_record.coupon_id;
            
            IF total_usage >= promo_record.max_redemptions THEN
                RETURN FALSE;
            END IF;
        END;
    END IF;
    
    -- Increment usage count
    UPDATE "public"."promo_codes"
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE code = promo_code_text;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION increment_promo_code_usage(TEXT) IS 'Safely increment promo code usage with validation checks';
