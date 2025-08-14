-- Add "refunded" to payment_status enum
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'refunded';

-- Add comment to document the new status
COMMENT ON TYPE "public"."payment_status" IS 'Payment status: processing, paid, canceled, or refunded';