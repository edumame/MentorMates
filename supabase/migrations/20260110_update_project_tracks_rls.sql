-- Update project_tracks RLS policies to allow organizers to manage tracks for their events

-- Drop existing policies
DROP POLICY IF EXISTS "project_tracks_insert_authenticated" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_update_members" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_delete_members" ON public.project_tracks;

-- Policy: Allow project members OR event organizers to insert tracks
-- This allows organizers to add tracks when importing projects
CREATE POLICY "Allow project members and organizers to insert tracks"
ON public.project_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user is a project member
  public.is_project_member(project_id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event that the track belongs to
  EXISTS (
    SELECT 1
    FROM public.event_tracks et
    WHERE et.track_id = project_tracks.track_id
      AND public.is_event_organizer(et.event_id, (SELECT auth.uid()))
  )
);

-- Policy: Allow project members OR event organizers to update tracks
CREATE POLICY "Allow project members and organizers to update tracks"
ON public.project_tracks
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is a project member
  public.is_project_member(project_id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event that the track belongs to
  EXISTS (
    SELECT 1
    FROM public.event_tracks et
    WHERE et.track_id = project_tracks.track_id
      AND public.is_event_organizer(et.event_id, (SELECT auth.uid()))
  )
)
WITH CHECK (
  -- Allow if user is a project member
  public.is_project_member(project_id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event that the track belongs to
  EXISTS (
    SELECT 1
    FROM public.event_tracks et
    WHERE et.track_id = project_tracks.track_id
      AND public.is_event_organizer(et.event_id, (SELECT auth.uid()))
  )
);

-- Policy: Allow project members OR event organizers to delete tracks
CREATE POLICY "Allow project members and organizers to delete tracks"
ON public.project_tracks
FOR DELETE
TO authenticated
USING (
  -- Allow if user is a project member
  public.is_project_member(project_id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event that the track belongs to
  EXISTS (
    SELECT 1
    FROM public.event_tracks et
    WHERE et.track_id = project_tracks.track_id
      AND public.is_event_organizer(et.event_id, (SELECT auth.uid()))
  )
);

