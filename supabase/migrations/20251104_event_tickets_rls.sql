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
DROP POLICY IF EXISTS "Users can view tickets they purchased or were assigned, organizers can view all event tickets, and admins can view all tickets" ON public.event_tickets;
DROP POLICY IF EXISTS "Users can update tickets they purchased or were assigned" ON public.event_tickets;
DROP POLICY IF EXISTS "Users can delete tickets they purchased or were assigned" ON public.event_tickets;

-- Policy: Allow viewing tickets based on purchase, assignment, organizer role, or admin status
CREATE POLICY "Users can view tickets they purchased or were assigned, organizers can view all event tickets, and admins can view all tickets"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  -- User purchased the ticket
  purchased_by_user_id = (SELECT auth.uid())
  OR
  -- Ticket is assigned to the user
  assigned_to_user_id = (SELECT auth.uid())
  OR
  -- User is an organizer for the event
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR
  -- User is an admin
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Allow users to update tickets they purchased or were assigned
CREATE POLICY "Users can update tickets they purchased or were assigned"
ON public.event_tickets
FOR UPDATE
TO authenticated
USING (
  purchased_by_user_id = (SELECT auth.uid())
  OR
  assigned_to_user_id = (SELECT auth.uid())
)
WITH CHECK (
  purchased_by_user_id = (SELECT auth.uid())
  OR
  assigned_to_user_id = (SELECT auth.uid())
);

-- Policy: Allow users to delete tickets they purchased or were assigned
CREATE POLICY "Users can delete tickets they purchased or were assigned"
ON public.event_tickets
FOR DELETE
TO authenticated
USING (
  purchased_by_user_id = (SELECT auth.uid())
  OR
  assigned_to_user_id = (SELECT auth.uid())
);

