-- Helper function to check if a user is a judge for an event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_event_judge(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_event_roles 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND role = 'judge'
  );
END;
$$;

-- Helper function to check if a user is a judge or organizer for an event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_event_judge_or_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_event_roles 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND role IN ('judge', 'organizer')
  );
END;
$$;

-- Enable RLS on project_scores table
ALTER TABLE public.project_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "project_scores_select_judges_organizers" ON public.project_scores;
DROP POLICY IF EXISTS "project_scores_insert_judges_organizers" ON public.project_scores;
DROP POLICY IF EXISTS "project_scores_update_own_judge" ON public.project_scores;
DROP POLICY IF EXISTS "project_scores_update_organizer" ON public.project_scores;
DROP POLICY IF EXISTS "project_scores_delete_own_judge" ON public.project_scores;
DROP POLICY IF EXISTS "project_scores_delete_organizer" ON public.project_scores;

-- Policy 1: Allow judges and organizers to view all project scores for their events
CREATE POLICY "project_scores_select_judges_organizers"
ON public.project_scores
FOR SELECT
TO authenticated
USING (
  event_id IS NOT NULL 
  AND public.is_event_judge_or_organizer(event_id, auth.uid())
);

-- Policy 2: Allow judges and organizers to insert scores for their events
-- Judges can only insert scores with their own judge_id
-- Organizers can insert scores for any judge
CREATE POLICY "project_scores_insert_judges_organizers"
ON public.project_scores
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IS NOT NULL 
  AND (
    -- Judges can insert their own scores
    (public.is_event_judge(event_id, auth.uid()) AND judge_id = auth.uid())
    OR
    -- Organizers can insert scores for any judge
    public.is_event_organizer(event_id, auth.uid())
  )
);

-- Policy 3: Allow judges to update their own scores
CREATE POLICY "project_scores_update_own_judge"
ON public.project_scores
FOR UPDATE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND judge_id = auth.uid()
  AND public.is_event_judge(event_id, auth.uid())
)
WITH CHECK (
  event_id IS NOT NULL 
  AND judge_id = auth.uid()
  AND public.is_event_judge(event_id, auth.uid())
);

-- Policy 4: Allow organizers to update any score for their events
CREATE POLICY "project_scores_update_organizer"
ON public.project_scores
FOR UPDATE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND public.is_event_organizer(event_id, auth.uid())
)
WITH CHECK (
  event_id IS NOT NULL 
  AND public.is_event_organizer(event_id, auth.uid())
);

-- Policy 5: Allow judges to delete their own scores
CREATE POLICY "project_scores_delete_own_judge"
ON public.project_scores
FOR DELETE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND judge_id = auth.uid()
  AND public.is_event_judge(event_id, auth.uid())
);

-- Policy 6: Allow organizers to delete any score for their events
CREATE POLICY "project_scores_delete_organizer"
ON public.project_scores
FOR DELETE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND public.is_event_organizer(event_id, auth.uid())
);

