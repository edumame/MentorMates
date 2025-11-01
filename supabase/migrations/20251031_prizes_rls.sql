-- Helper function to check if a user is an organizer for a track's event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_track_event_organizer(p_track_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.event_tracks et
    INNER JOIN public.user_event_roles uer 
      ON et.event_id = uer.event_id
    WHERE et.track_id = p_track_id
      AND uer.user_id = p_user_id 
      AND uer.role = 'organizer'
  );
END;
$$;

-- Enable RLS on prizes table
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "prizes_select_public" ON public.prizes;
DROP POLICY IF EXISTS "prizes_insert_organizer" ON public.prizes;
DROP POLICY IF EXISTS "prizes_update_organizer" ON public.prizes;
DROP POLICY IF EXISTS "prizes_delete_organizer" ON public.prizes;

-- Policy 1: Allow everyone (including anonymous users) to view all prizes
CREATE POLICY "prizes_select_public"
ON public.prizes
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow organizers to insert prizes for their event's tracks
CREATE POLICY "prizes_insert_organizer"
ON public.prizes
FOR INSERT
TO authenticated
WITH CHECK (
  track_id IS NOT NULL 
  AND public.is_track_event_organizer(track_id, auth.uid())
);

-- Policy 3: Allow organizers to update prizes for their event's tracks
CREATE POLICY "prizes_update_organizer"
ON public.prizes
FOR UPDATE
TO authenticated
USING (
  track_id IS NOT NULL 
  AND public.is_track_event_organizer(track_id, auth.uid())
)
WITH CHECK (
  track_id IS NOT NULL 
  AND public.is_track_event_organizer(track_id, auth.uid())
);

-- Policy 4: Allow organizers to delete prizes for their event's tracks
CREATE POLICY "prizes_delete_organizer"
ON public.prizes
FOR DELETE
TO authenticated
USING (
  track_id IS NOT NULL 
  AND public.is_track_event_organizer(track_id, auth.uid())
);

