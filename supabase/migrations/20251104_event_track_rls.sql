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
DROP POLICY IF EXISTS "Anyone can view tracks for public and private events, participants can view tracks for draft events, and admins can view all tracks" ON public.event_tracks;
DROP POLICY IF EXISTS "Event organizers and admins can create tracks for events" ON public.event_tracks;
DROP POLICY IF EXISTS "Event organizers and admins can update tracks for events" ON public.event_tracks;
DROP POLICY IF EXISTS "Event organizers and admins can delete tracks from events" ON public.event_tracks;

-- Policy: Allow viewing event tracks based on event visibility
CREATE POLICY "Anyone can view tracks for public and private events, participants can view tracks for draft events, and admins can view all tracks"
ON public.event_tracks
FOR SELECT
USING (
  -- Public and private events are visible to everyone
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.event_id = event_tracks.event_id
    AND events.visibility IN ('public'::event_visibility, 'private'::event_visibility)
  )
  OR
  -- Draft events are visible to participants and owners
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.event_id = event_tracks.event_id
    AND events.visibility = 'draft'::event_visibility
    AND (
      (SELECT auth.uid()) IS NOT NULL
      AND (
        public.user_has_event_role(events.event_id, (SELECT auth.uid()))
        OR events.owner_id = (SELECT auth.uid())
      )
    )
  )
  OR
  -- Admins can view all tracks
  ((SELECT auth.uid()) IS NOT NULL AND public.is_admin_user((SELECT auth.uid())))
);

-- Policy: Allow event organizers and admins to create tracks
CREATE POLICY "Event organizers and admins can create tracks for events"
ON public.event_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Allow event organizers and admins to update tracks
CREATE POLICY "Event organizers and admins can update tracks for events"
ON public.event_tracks
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Allow event organizers and admins to delete tracks
CREATE POLICY "Event organizers and admins can delete tracks from events"
ON public.event_tracks
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
);

