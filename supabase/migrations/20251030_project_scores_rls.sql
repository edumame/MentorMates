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
DROP POLICY IF EXISTS "Judges and organizers can view project scores for their events" ON public.project_scores;
DROP POLICY IF EXISTS "Judges can submit scores and organizers can submit any score for their events" ON public.project_scores;
DROP POLICY IF EXISTS "Judges can edit their own scores and organizers can edit any score for their events" ON public.project_scores;
DROP POLICY IF EXISTS "Judges can delete their own scores and organizers can delete any score for their events" ON public.project_scores;

-- Policy: Allow judges and organizers to view all project scores for their events
CREATE POLICY "Judges and organizers can view project scores for their events"
ON public.project_scores
FOR SELECT
TO authenticated
USING (
  event_id IS NOT NULL 
  AND public.is_event_judge_or_organizer(event_id, (SELECT auth.uid()))
);

-- Policy: Allow judges to insert their own scores and organizers to insert any score
CREATE POLICY "Judges can submit scores and organizers can submit any score for their events"
ON public.project_scores
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IS NOT NULL 
  AND (
    -- Judges can insert their own scores
    (public.is_event_judge(event_id, (SELECT auth.uid())) AND judge_id = (SELECT auth.uid()))
    OR
    -- Organizers can insert scores for any judge
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  )
);

-- Policy: Allow judges to update their own scores and organizers to update any score
CREATE POLICY "Judges can edit their own scores and organizers can edit any score for their events"
ON public.project_scores
FOR UPDATE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND (
    -- Judges can update their own scores
    (judge_id = (SELECT auth.uid()) AND public.is_event_judge(event_id, (SELECT auth.uid())))
    OR
    -- Organizers can update any score
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  )
)
WITH CHECK (
  event_id IS NOT NULL 
  AND (
    -- Judges can update their own scores
    (judge_id = (SELECT auth.uid()) AND public.is_event_judge(event_id, (SELECT auth.uid())))
    OR
    -- Organizers can update any score
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  )
);

-- Policy: Allow judges to delete their own scores and organizers to delete any score
CREATE POLICY "Judges can delete their own scores and organizers can delete any score for their events"
ON public.project_scores
FOR DELETE
TO authenticated
USING (
  event_id IS NOT NULL 
  AND (
    -- Judges can delete their own scores
    (judge_id = (SELECT auth.uid()) AND public.is_event_judge(event_id, (SELECT auth.uid())))
    OR
    -- Organizers can delete any score
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  )
);

