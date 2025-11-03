-- Helper function to check if a user can view feedback
-- User can view feedback if:
-- 1. The feedback is for a public project (private = false)
-- 2. The feedback is for a private project AND the user has joined the event
CREATE OR REPLACE FUNCTION public.can_view_feedback(p_feedback_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feedback_project_id uuid;
  feedback_event_id uuid;
  project_is_private boolean;
BEGIN
  -- Get feedback's project_id and event_id
  SELECT project_id, event_id 
  INTO feedback_project_id, feedback_event_id
  FROM public.feedback
  WHERE id = p_feedback_id;
  
  -- If feedback has a project_id, check project privacy
  IF feedback_project_id IS NOT NULL THEN
    SELECT COALESCE(private, false) 
    INTO project_is_private
    FROM public.projects
    WHERE id = feedback_project_id;
    
    -- If project is public, anyone can view
    IF NOT project_is_private THEN
      RETURN true;
    END IF;
    
    -- If project is private, check if user has joined the project's event
    SELECT event_id INTO feedback_event_id
    FROM public.projects
    WHERE id = feedback_project_id;
  END IF;
  
  -- For private projects or feedback with event_id, check event participation
  IF feedback_event_id IS NOT NULL THEN
    RETURN public.user_has_event_role(feedback_event_id, p_user_id);
  END IF;
  
  -- Default: deny access
  RETURN false;
END;
$$;

-- Helper function to check if feedback is for a public project
CREATE OR REPLACE FUNCTION public.is_feedback_public(p_feedback_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feedback_project_id uuid;
  project_is_private boolean;
BEGIN
  -- Get feedback's project_id
  SELECT project_id 
  INTO feedback_project_id
  FROM public.feedback
  WHERE id = p_feedback_id;
  
  -- If no project_id, feedback is not public
  IF feedback_project_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if project is public (private = false)
  SELECT NOT COALESCE(private, true)
  INTO project_is_private
  FROM public.projects
  WHERE id = feedback_project_id;
  
  RETURN COALESCE(project_is_private, false);
END;
$$;

-- Enable RLS on feedback table
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "feedback_select_public" ON public.feedback;
DROP POLICY IF EXISTS "feedback_select_private_event_participants" ON public.feedback;
DROP POLICY IF EXISTS "feedback_insert_authenticated" ON public.feedback;
DROP POLICY IF EXISTS "feedback_update_mentor" ON public.feedback;
DROP POLICY IF EXISTS "feedback_delete_mentor" ON public.feedback;

-- Policy 1: Allow anyone (including anonymous users) to view feedback on public projects
CREATE POLICY "feedback_select_public"
ON public.feedback
FOR SELECT
USING (
  -- For anonymous users, only allow if feedback is for a public project
  (auth.uid() IS NULL AND public.is_feedback_public(id))
);

-- Policy 2: Allow authenticated users to view feedback on private projects if they've joined the event
CREATE POLICY "feedback_select_private_event_participants"
ON public.feedback
FOR SELECT
TO authenticated
USING (
  public.can_view_feedback(id, auth.uid())
);

-- Policy 3: Allow authenticated users to insert feedback
-- They can only create feedback for projects in events they've joined
CREATE POLICY "feedback_insert_authenticated"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if no event_id (standalone feedback)
  event_id IS NULL 
  OR 
  -- Or if user has joined the event
  public.user_has_event_role(event_id, auth.uid())
);

-- Policy 4: Allow mentors to update their own feedback
CREATE POLICY "feedback_update_mentor"
ON public.feedback
FOR UPDATE
TO authenticated
USING (
  mentor_id = auth.uid()
)
WITH CHECK (
  mentor_id = auth.uid()
);

-- Policy 5: Allow mentors to delete their own feedback
CREATE POLICY "feedback_delete_mentor"
ON public.feedback
FOR DELETE
TO authenticated
USING (
  mentor_id = auth.uid()
);

