-- Migration to create one event ticket for each existing user_event_payment
-- This should run after 20250822_add_tickets.sql
-- Assumes each payment = 1 ticket

-- Insert one ticket for each existing payment
INSERT INTO "public"."event_tickets" (
    "event_id",
    "payment_id", 
    "purchased_by_user_id",
    "assigned_to_user_id",
    "ticket_status",
    "assigned_at",
    "created_at",
    "updated_at"
)
SELECT 
    uep."event_id",
    uep."id" as "payment_id",
    uep."user_id" as "purchased_by_user_id",
    uep."user_id" as "assigned_to_user_id", -- Assign to purchaser
    'assigned'::ticket_status_enum as "ticket_status", -- Mark as assigned since they already paid
    uep."created_at" as "assigned_at", -- Use payment creation time as assignment time
    uep."created_at",
    uep."updated_at"
FROM "public"."user_event_payments" uep
WHERE uep."payment_status" = 'paid' -- Only create tickets for successful payments
AND NOT EXISTS (
    -- Only insert if no ticket already exists for this payment
    SELECT 1 FROM "public"."event_tickets" et 
    WHERE et."payment_id" = uep."id"
);

-- Log the migration results
DO $$
DECLARE
    ticket_count integer;
BEGIN
    SELECT COUNT(*) INTO ticket_count FROM "public"."event_tickets";
    
    RAISE NOTICE 'Migration completed: Created % tickets (1 per payment)', ticket_count;
END $$;