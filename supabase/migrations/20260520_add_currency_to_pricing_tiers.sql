ALTER TABLE "public"."pricing_tiers"
ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'usd';

COMMENT ON COLUMN "public"."pricing_tiers"."currency" IS 'Currency code used for pricing tier display. Should match the Stripe price currency.';
