-- Update projects RLS policies to allow organizers to manage projects for their events

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated users can create projects for events they joined" ON public.projects;
DROP POLICY IF EXISTS "project team members can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "project team members can delete their own projects" ON public.projects;

-- INSERT: Authenticated users can create projects for events they have joined OR organizers can create projects for their events
CREATE POLICY "authenticated users can create projects for events they joined OR organizers can create projects for their events"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if no event (standalone project)
  event_id IS NULL 
  OR
  -- Allow if user has joined the event
  public.user_has_event_role(event_id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event
  public.is_event_organizer(event_id, (SELECT auth.uid()))
);

-- UPDATE: Project team members OR event organizers can update projects
CREATE POLICY "Project team members can update their own projects OR event organizers can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is a project member
  public.is_project_member(id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event
  (event_id IS NOT NULL AND public.is_event_organizer(event_id, (SELECT auth.uid())))
)
WITH CHECK (
  -- Allow if user is a project member
  public.is_project_member(id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event
  (event_id IS NOT NULL AND public.is_event_organizer(event_id, (SELECT auth.uid())))
);

-- DELETE: Project team members OR event organizers can delete projects
CREATE POLICY "Project team members can delete their own projects OR event organizers can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  -- Allow if user is a project member
  public.is_project_member(id, (SELECT auth.uid()))
  OR
  -- Allow if user is an organizer for the event
  (event_id IS NOT NULL AND public.is_event_organizer(event_id, (SELECT auth.uid())))
);

