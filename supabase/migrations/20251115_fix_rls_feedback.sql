-- Update feedback insert policy to allow anonymous users to submit feedback for public projects
DROP POLICY IF EXISTS "Event participants can submit feedback for projects in their events" ON public.feedback;

-- Helper function to check if a project is public
CREATE OR REPLACE FUNCTION public.is_project_public(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_is_private boolean;
BEGIN
  -- Check if project is public (private = false)
  SELECT COALESCE(private, true)
  INTO project_is_private
  FROM public.projects
  WHERE id = p_project_id;
  
  RETURN NOT COALESCE(project_is_private, true);
END;
$$;

-- Policy: Allow anonymous users to submit feedback for public projects, and authenticated users for events they've joined
CREATE POLICY "Event participants can submit feedback for projects in their events"
ON public.feedback
FOR INSERT
WITH CHECK (
  -- Anonymous users can only submit feedback for public projects
  (
    (SELECT auth.uid()) IS NULL 
    AND project_id IS NOT NULL 
    AND public.is_project_public(project_id)
  )
  OR
  -- Authenticated users can submit feedback if:
  (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      -- No event_id (standalone feedback)
      event_id IS NULL 
      OR 
      -- User has joined the event
      public.user_has_event_role(event_id, (SELECT auth.uid()))
      OR
      -- Project is public
      (project_id IS NOT NULL AND public.is_project_public(project_id))
    )
  )
);

