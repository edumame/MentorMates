-- Enable Row Level Security on user_event_payments table
ALTER TABLE public.user_event_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own payment records" ON public.user_event_payments;

-- Policy: Allow users to read only their own payment records
CREATE POLICY "Users can view their own payment records"
ON public.user_event_payments
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- No INSERT, UPDATE, or DELETE policies are created
-- This ensures users cannot modify payment records through the client
-- All payment modifications should be done server-side through secure API routes

