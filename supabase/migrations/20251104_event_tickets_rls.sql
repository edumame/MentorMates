-- Enable RLS on event_tickets table
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "event_tickets_select_purchaser" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_select_assigned" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_select_organizer" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_select_admin" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_update_purchaser" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_update_assigned" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_delete_purchaser" ON public.event_tickets;
DROP POLICY IF EXISTS "event_tickets_delete_assigned" ON public.event_tickets;

-- ============================================================================
-- SELECT POLICIES (View Tickets)
-- ============================================================================

-- Policy 1: Allow users to view tickets they purchased
CREATE POLICY "event_tickets_select_purchaser"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  purchased_by_user_id = auth.uid()
);

-- Policy 2: Allow users to view tickets assigned to them
CREATE POLICY "event_tickets_select_assigned"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
);

-- Policy 3: Allow event organizers to view tickets for their events
CREATE POLICY "event_tickets_select_organizer"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 4: Allow admin users to view all tickets
CREATE POLICY "event_tickets_select_admin"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- UPDATE POLICIES (Modify Tickets)
-- ============================================================================

-- Policy 5: Allow users to update tickets they purchased
CREATE POLICY "event_tickets_update_purchaser"
ON public.event_tickets
FOR UPDATE
TO authenticated
USING (
  purchased_by_user_id = auth.uid()
)
WITH CHECK (
  purchased_by_user_id = auth.uid()
);

-- Policy 6: Allow users to update tickets assigned to them
CREATE POLICY "event_tickets_update_assigned"
ON public.event_tickets
FOR UPDATE
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
)
WITH CHECK (
  assigned_to_user_id = auth.uid()
);

-- ============================================================================
-- DELETE POLICIES (Remove Tickets)
-- ============================================================================

-- Policy 7: Allow users to delete tickets they purchased
CREATE POLICY "event_tickets_delete_purchaser"
ON public.event_tickets
FOR DELETE
TO authenticated
USING (
  purchased_by_user_id = auth.uid()
);

-- Policy 8: Allow users to delete tickets assigned to them
CREATE POLICY "event_tickets_delete_assigned"
ON public.event_tickets
FOR DELETE
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
);

