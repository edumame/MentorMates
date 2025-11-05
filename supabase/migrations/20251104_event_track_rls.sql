-- Helper function to check if a user is an organizer or owner for an event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_event_organizer_or_owner(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.events 
    WHERE event_id = p_event_id 
      AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 
    FROM public.user_event_roles 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND role = 'organizer'
  );
END;
$$;


-- Enable RLS on event_tracks table
ALTER TABLE public.event_tracks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "event_tracks_select_public_events" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_select_private_events" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_select_participants" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_select_admin" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_insert_organizer" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_insert_admin" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_update_organizer" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_update_admin" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_delete_organizer" ON public.event_tracks;
DROP POLICY IF EXISTS "event_tracks_delete_admin" ON public.event_tracks;

-- ============================================================================
-- SELECT POLICIES (View Event Tracks)
-- ============================================================================

-- Policy 1: Allow everyone (including anonymous) to view tracks for public events
CREATE POLICY "event_tracks_select_public_events"
ON public.event_tracks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.event_id = event_tracks.event_id
    AND events.visibility = 'public'::event_visibility
  )
);

-- Policy 2: Allow everyone (including anonymous) to view tracks for private events
CREATE POLICY "event_tracks_select_private_events"
ON public.event_tracks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.event_id = event_tracks.event_id
    AND events.visibility = 'private'::event_visibility
  )
);

-- Policy 3: Allow authenticated participants to view tracks for draft events they're part of
CREATE POLICY "event_tracks_select_participants"
ON public.event_tracks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.event_id = event_tracks.event_id
    AND events.visibility = 'draft'::event_visibility
    AND (
      public.user_has_event_role(events.event_id, auth.uid())
      OR events.owner_id = auth.uid()
    )
  )
);

-- Policy 4: Allow admin users to view all event tracks
CREATE POLICY "event_tracks_select_admin"
ON public.event_tracks
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- INSERT POLICIES (Create Event Tracks)
-- ============================================================================

-- Policy 5: Allow event organizers to create tracks for their events
CREATE POLICY "event_tracks_insert_organizer"
ON public.event_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_event_organizer_or_owner(event_id, auth.uid())
);

-- Policy 6: Allow admin users to create tracks for any event
CREATE POLICY "event_tracks_insert_admin"
ON public.event_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- UPDATE POLICIES (Modify Event Tracks)
-- ============================================================================

-- Policy 7: Allow event organizers to update tracks for their events
CREATE POLICY "event_tracks_update_organizer"
ON public.event_tracks
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer_or_owner(event_id, auth.uid())
)
WITH CHECK (
  public.is_event_organizer_or_owner(event_id, auth.uid())
);

-- Policy 8: Allow admin users to update any event track
CREATE POLICY "event_tracks_update_admin"
ON public.event_tracks
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
)
WITH CHECK (
  public.is_admin_user(auth.uid())
);

-- ============================================================================
-- DELETE POLICIES (Remove Event Tracks)
-- ============================================================================

-- Policy 9: Allow event organizers to delete tracks from their events
CREATE POLICY "event_tracks_delete_organizer"
ON public.event_tracks
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer_or_owner(event_id, auth.uid())
);

-- Policy 10: Allow admin users to delete any event track
CREATE POLICY "event_tracks_delete_admin"
ON public.event_tracks
FOR DELETE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

