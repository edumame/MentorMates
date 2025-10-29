-- Add private column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS private boolean NOT NULL DEFAULT false;

-- Create index for private column for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_private ON public.projects USING btree (private) TABLESPACE pg_default;

-- Helper function to check if a user is a project team member (lead or teammate)
-- This function checks if the user's email matches the lead_email or is in the teammates array
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Check if user is lead or teammate
  RETURN EXISTS (
    SELECT 1 
    FROM public.projects 
    WHERE id = p_project_id 
      AND (
        lead_email = user_email 
        OR user_email = ANY(teammates)
      )
  );
END;
$$;

-- Helper function to check if a user can view a private project
-- User can view if they are:
-- 1. A project member (lead or teammate)
-- 2. Have joined the event that the project belongs to
CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_event_id uuid;
  project_is_private boolean;
BEGIN
  -- Get project's event_id and private status
  SELECT event_id, private INTO project_event_id, project_is_private
  FROM public.projects
  WHERE id = p_project_id;
  
  -- If project is public, anyone can view
  IF NOT project_is_private THEN
    RETURN true;
  END IF;
  
  -- If project is private, check if user is a member
  IF public.is_project_member(p_project_id, p_user_id) THEN
    RETURN true;
  END IF;
  
  -- If project has an event, check if user has joined that event
  IF project_event_id IS NOT NULL THEN
    RETURN public.user_has_event_role(project_event_id, p_user_id);
  END IF;
  
  -- Default: deny access
  RETURN false;
END;
$$;

-- Enable RLS on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "projects_select_public" ON public.projects;
DROP POLICY IF EXISTS "projects_select_private_members" ON public.projects;
DROP POLICY IF EXISTS "projects_select_private_event_participants" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_authenticated" ON public.projects;
DROP POLICY IF EXISTS "projects_update_members" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_members" ON public.projects;

-- Policy 1: Allow anyone (authenticated or not) to view public projects
CREATE POLICY "projects_select_public"
ON public.projects
FOR SELECT
USING (
  private = false
);

-- Policy 2: Allow authenticated users to view private projects if they are members
CREATE POLICY "projects_select_private_members"
ON public.projects
FOR SELECT
TO authenticated
USING (
  private = true 
  AND public.is_project_member(id, auth.uid())
);

-- Policy 3: Allow authenticated users to view private projects if they've joined the event
CREATE POLICY "projects_select_private_event_participants"
ON public.projects
FOR SELECT
TO authenticated
USING (
  private = true 
  AND event_id IS NOT NULL
  AND public.user_has_event_role(event_id, auth.uid())
);

-- Policy 4: Allow authenticated users to create projects
-- They can only create projects for events they've joined or with NULL event_id
CREATE POLICY "projects_insert_authenticated"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IS NULL 
  OR public.user_has_event_role(event_id, auth.uid())
);

-- Policy 5: Allow project members (lead or teammates) to update their projects
CREATE POLICY "projects_update_members"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  public.is_project_member(id, auth.uid())
)
WITH CHECK (
  public.is_project_member(id, auth.uid())
);

-- Policy 6: Allow project members (lead or teammates) to delete their projects
CREATE POLICY "projects_delete_members"
ON public.projects
FOR DELETE
TO authenticated
USING (
  public.is_project_member(id, auth.uid())
);

-- Grant necessary permissions
GRANT SELECT ON public.projects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;

