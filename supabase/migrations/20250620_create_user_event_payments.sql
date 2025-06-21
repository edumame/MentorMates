-- Create payment status enum
CREATE TYPE "public"."payment_status" AS ENUM (
    'processing',
    'paid',
    'canceled'
);

-- Create user_event_payments table
CREATE TABLE IF NOT EXISTS "public"."user_event_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'processing' NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent_id" "text",
    "amount_paid" integer,
    "currency" "text" DEFAULT 'usd',
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Set table owner
ALTER TABLE "public"."user_event_payments" OWNER TO "postgres";

-- Add primary key constraint
ALTER TABLE ONLY "public"."user_event_payments"
    ADD CONSTRAINT "user_event_payments_pkey" PRIMARY KEY ("id");

-- Add unique constraint to prevent duplicate payment records for same user-event combination
ALTER TABLE ONLY "public"."user_event_payments"
    ADD CONSTRAINT "user_event_payments_user_event_unique" UNIQUE ("user_id", "event_id");

-- Add foreign key constraints
ALTER TABLE ONLY "public"."user_event_payments"
    ADD CONSTRAINT "user_event_payments_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("uid") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_event_payments"
    ADD CONSTRAINT "user_event_payments_event_id_fkey" 
    FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX "idx_user_event_payments_user_id" ON "public"."user_event_payments" USING "btree" ("user_id");
CREATE INDEX "idx_user_event_payments_event_id" ON "public"."user_event_payments" USING "btree" ("event_id");
CREATE INDEX "idx_user_event_payments_status" ON "public"."user_event_payments" USING "btree" ("payment_status");
CREATE INDEX "idx_user_event_payments_stripe_customer" ON "public"."user_event_payments" USING "btree" ("stripe_customer_id");

-- Add trigger to update updated_at column
CREATE OR REPLACE TRIGGER "update_user_event_payments_updated_at" 
    BEFORE UPDATE ON "public"."user_event_payments" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Add comments to document the table and columns
COMMENT ON TABLE "public"."user_event_payments" IS 'Tracks payment status for users registering for paid events';
COMMENT ON COLUMN "public"."user_event_payments"."user_id" IS 'Reference to user who made the payment';
COMMENT ON COLUMN "public"."user_event_payments"."event_id" IS 'Reference to the event being paid for';
COMMENT ON COLUMN "public"."user_event_payments"."stripe_customer_id" IS 'Stripe customer ID for the user';
COMMENT ON COLUMN "public"."user_event_payments"."payment_status" IS 'Status of the payment: processing, paid, or canceled';
COMMENT ON COLUMN "public"."user_event_payments"."stripe_session_id" IS 'Stripe checkout session ID';
COMMENT ON COLUMN "public"."user_event_payments"."stripe_payment_intent_id" IS 'Stripe payment intent ID';
COMMENT ON COLUMN "public"."user_event_payments"."amount_paid" IS 'Amount paid in cents (e.g., 2000 = $20.00)';
COMMENT ON COLUMN "public"."user_event_payments"."currency" IS 'Currency code (e.g., usd, eur)';

-- Enable Row Level Security
ALTER TABLE "public"."user_event_payments" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own payment records
CREATE POLICY "Users can view own payments" ON "public"."user_event_payments"
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own payment records
CREATE POLICY "Users can create own payments" ON "public"."user_event_payments"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment records (for status changes)
CREATE POLICY "Users can update own payments" ON "public"."user_event_payments"
    FOR UPDATE USING (auth.uid() = user_id);

-- Event organizers can view all payments for their events
CREATE POLICY "Organizers can view event payments" ON "public"."user_event_payments"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."user_event_roles" 
            WHERE "user_id" = auth.uid() 
            AND "event_id" = "user_event_payments"."event_id"
            AND "role" = 'organizer'
        )
    ); 