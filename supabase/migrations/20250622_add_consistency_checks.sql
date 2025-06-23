ALTER TABLE "public"."events" 
ADD CONSTRAINT check_if_paid_then_stripe CHECK (paid = false OR stripe_price_id IS NOT NULL),
ADD CONSTRAINT check_if_paid_then_price CHECK (paid = false OR price IS NOT NULL);