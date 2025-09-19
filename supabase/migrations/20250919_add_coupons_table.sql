-- Create coupons table for event-specific discount codes
-- Coupons support either percent_off (1-100) or amount_off (in cents), not both

CREATE TABLE IF NOT EXISTS "public"."coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "public"."events"("event_id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "percent_off" integer CHECK (percent_off IS NULL OR (percent_off >= 1 AND percent_off <= 100)),
  "amount_off" integer CHECK (amount_off IS NULL OR amount_off > 0), -- cents
  "max_redemptions" integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  "usage_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_exactly_one_discount CHECK (
    (percent_off IS NOT NULL AND amount_off IS NULL) OR (percent_off IS NULL AND amount_off IS NOT NULL)
  )
);

-- Ensure code uniqueness per event (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS coupons_event_code_unique
ON "public"."coupons" ("event_id", lower("code"));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS coupons_event_id_idx ON "public"."coupons" ("event_id");
CREATE INDEX IF NOT EXISTS coupons_active_idx ON "public"."coupons" ("is_active");
CREATE INDEX IF NOT EXISTS coupons_expires_at_idx ON "public"."coupons" ("expires_at");

-- Trigger to maintain updated_at
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON "public"."coupons"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Add coupon_id to user_event_payments for auditability
ALTER TABLE "public"."user_event_payments"
ADD COLUMN IF NOT EXISTS "coupon_id" uuid REFERENCES "public"."coupons"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_event_payments_coupon_id_idx ON "public"."user_event_payments" ("coupon_id");

-- RLS policies
ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;

-- Organizers/Admins of the event can manage coupons
DROP POLICY IF EXISTS "Organizers can manage coupons for their events" ON "public"."coupons";
CREATE POLICY "Organizers can manage coupons for their events"
ON "public"."coupons"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."user_event_roles" uer
    WHERE uer."user_id" = auth.uid()
      AND uer."event_id" = "coupons"."event_id"
      AND uer."role" IN ('organizer', 'admin')
  ) OR (SELECT is_admin_user(auth.uid()::uuid))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."user_event_roles" uer
    WHERE uer."user_id" = auth.uid()
      AND uer."event_id" = "coupons"."event_id"
      AND uer."role" IN ('organizer', 'admin')
  ) OR (SELECT is_admin_user(auth.uid()::uuid))
);

COMMENT ON POLICY "Organizers can manage coupons for their events" ON "public"."coupons" IS 'Authenticated organizers/admins may create, update, delete, select coupons for their events.';

-- Validation RPC: validate a coupon for an event and code
-- SECURITY DEFINER so participants can validate without listing all coupons
CREATE OR REPLACE FUNCTION public.validate_coupon(p_event_id uuid, p_code text)
RETURNS public.coupons
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c public.coupons;
  v_event_end timestamptz;
BEGIN
  SELECT * INTO c
  FROM public.coupons
  WHERE event_id = p_event_id AND lower(code) = lower(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found' USING ERRCODE = 'P0002';
  END IF;

  -- All coupons expire when the event ends
  SELECT (event_date)::timestamptz INTO v_event_end FROM public.events WHERE event_id = p_event_id;
  IF v_event_end IS NOT NULL AND v_event_end < now() THEN
    RAISE EXCEPTION 'Event has ended; coupons are no longer valid' USING ERRCODE = 'P0001';
  END IF;

  IF c.is_active = false THEN
    RAISE EXCEPTION 'Coupon is inactive' USING ERRCODE = 'P0001';
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon has expired' USING ERRCODE = 'P0001';
  END IF;

  IF c.max_redemptions IS NOT NULL AND c.usage_count >= c.max_redemptions THEN
    RAISE EXCEPTION 'Coupon redemption limit reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN c;
END;
$$;

COMMENT ON FUNCTION public.validate_coupon(uuid, text) IS 'Validates coupon by event and code, enforcing active status, date limits, redemption limits, and event end.';

-- Simple helper to increment coupon usage after successful payment
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = p_coupon_id;
$$;

