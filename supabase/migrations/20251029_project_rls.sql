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
DROP POLICY IF EXISTS "anyone can view public projects or authorized users can view private projects" ON public.projects;
DROP POLICY IF EXISTS "authenticated users can create projects for events they joined" ON public.projects;
DROP POLICY IF EXISTS "project team members can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "project team members can delete their own projects" ON public.projects;

-- SELECT: Anyone can view public projects, or authorized users (team members or event participants) can view private projects
CREATE POLICY "anyone can view public projects or authorized users can view private projects"
ON public.projects
FOR SELECT
USING (
  private = false 
  OR public.can_view_project(id, (SELECT auth.uid()))
);

-- INSERT: Authenticated users can create projects for events they have joined or standalone projects
CREATE POLICY "authenticated users can create projects for events they joined"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IS NULL 
  OR public.user_has_event_role(event_id, (SELECT auth.uid()))
);

-- UPDATE: Project team members (lead or teammates) can update their own projects
CREATE POLICY "project team members can update their own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  public.is_project_member(id, (SELECT auth.uid()))
)
WITH CHECK (
  public.is_project_member(id, (SELECT auth.uid()))
);

-- DELETE: Project team members (lead or teammates) can delete their own projects
CREATE POLICY "project team members can delete their own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  public.is_project_member(id, (SELECT auth.uid()))
);

-- Grant necessary permissions
GRANT SELECT ON public.projects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;

