-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS "events_select_private_participants" ON public.events;
DROP POLICY IF EXISTS "events_select_draft_owner" ON public.events;
DROP POLICY IF EXISTS "events_select_admin" ON public.events;
DROP POLICY IF EXISTS "events_insert_organizer" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_organizer" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_organizer" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;

-- ============================================================================
-- SELECT POLICIES (View Events)
-- ============================================================================

-- Policy 1: Allow everyone (including anonymous) to view public events
CREATE POLICY "events_select_public"
ON public.events
FOR SELECT
USING (
  visibility = 'public'::event_visibility
);

-- Policy 2: Allow everyone (including anonymous) to view private events
CREATE POLICY "events_select_private"
ON public.events
FOR SELECT
USING (
  visibility = 'private'::event_visibility
);

-- Policy 3: Allow authenticated users to view draft events where they have a role
CREATE POLICY "events_select_draft_participants"
ON public.events
FOR SELECT
TO authenticated
USING (
  visibility = 'draft'::event_visibility
  AND public.user_has_event_role(event_id, auth.uid())
);

-- Policy 4: Allow event owners to view their own draft events
CREATE POLICY "events_select_draft_owner"
ON public.events
FOR SELECT
TO authenticated
USING (
  visibility = 'draft'::event_visibility
  AND owner_id = auth.uid()
);

-- Policy 5: Allow admin users to view all events (including drafts)
CREATE POLICY "events_select_admin"
ON public.events
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- INSERT POLICIES (Create Events)
-- ============================================================================

-- Policy 6: Allow event organizers to create events (they become the owner)
CREATE POLICY "events_insert_organizer"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be the owner of the event they're creating
  owner_id = auth.uid()
);

-- Policy 7: Allow admin users to create any event
CREATE POLICY "events_insert_admin"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- UPDATE POLICIES (Modify Events)
-- ============================================================================

-- Policy 8: Allow event owners to update their own events
CREATE POLICY "events_update_owner"
ON public.events
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
)
WITH CHECK (
  owner_id = auth.uid()
);

-- Policy 9: Allow organizers to update events where they have organizer role
CREATE POLICY "events_update_organizer"
ON public.events
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
)
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 10: Allow admin users to update any event
CREATE POLICY "events_update_admin"
ON public.events
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
)
WITH CHECK (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- DELETE POLICIES (Remove Events)
-- ============================================================================

-- Policy 11: Allow event owners to delete their own events
CREATE POLICY "events_delete_owner"
ON public.events
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
);

-- Policy 12: Allow organizers to delete events where they have organizer role
CREATE POLICY "events_delete_organizer"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 13: Allow admin users to delete any event
CREATE POLICY "events_delete_admin"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

