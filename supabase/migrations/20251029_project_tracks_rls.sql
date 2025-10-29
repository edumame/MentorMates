-- Helper function to check if a project is public
CREATE OR REPLACE FUNCTION public.is_project_public(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_public boolean;
BEGIN
  SELECT NOT COALESCE(private, true)
  INTO v_is_public
  FROM public.projects
  WHERE id = p_project_id;
  
  RETURN COALESCE(v_is_public, false);
END;
$$;

-- Helper function to check if a user can view project tracks
-- This wraps the can_view_project function to work with project_tracks
CREATE OR REPLACE FUNCTION public.can_view_project_tracks(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use the existing can_view_project function
  RETURN public.can_view_project(p_project_id, p_user_id);
END;
$$;

-- Enable RLS on project_tracks table
ALTER TABLE public.project_tracks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "project_tracks_select" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_select_public" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_select_private_members" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_select_private_event_participants" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_insert_authenticated" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_update_members" ON public.project_tracks;
DROP POLICY IF EXISTS "project_tracks_delete_members" ON public.project_tracks;

-- Policy 1: Unified SELECT policy using helper functions
-- Handles both public projects (anyone) and private projects (members/event participants)
CREATE POLICY "project_tracks_select"
ON public.project_tracks
FOR SELECT
USING (
  -- For authenticated users, use the full can_view_project logic
  (auth.uid() IS NOT NULL AND public.can_view_project(project_id, auth.uid()))
  OR
  -- For anonymous users, only allow if project is public
  (auth.uid() IS NULL AND public.is_project_public(project_id))
);

-- Policy 4: Allow authenticated users to insert tracks for projects they are members of
-- This ensures only project members can add tracks to their projects
CREATE POLICY "project_tracks_insert_authenticated"
ON public.project_tracks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_project_member(project_id, auth.uid())
);

-- Policy 5: Allow project members to update tracks for their projects
CREATE POLICY "project_tracks_update_members"
ON public.project_tracks
FOR UPDATE
TO authenticated
USING (
  public.is_project_member(project_id, auth.uid())
)
WITH CHECK (
  public.is_project_member(project_id, auth.uid())
);

-- Policy 6: Allow project members to delete tracks from their projects
CREATE POLICY "project_tracks_delete_members"
ON public.project_tracks
FOR DELETE
TO authenticated
USING (
  public.is_project_member(project_id, auth.uid())
);

