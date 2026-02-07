-- Add UPDATE policy for meeting_screen_context table
-- This enables Supabase Realtime subscriptions to receive UPDATE events

-- Enable update for authenticated users
CREATE POLICY "Enable update for authenticated users"
ON public.meeting_screen_context
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable update for service role (needed for worker subscriptions)
CREATE POLICY "Enable update for service role"
ON public.meeting_screen_context
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Enable Realtime publication for this table
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_screen_context;
