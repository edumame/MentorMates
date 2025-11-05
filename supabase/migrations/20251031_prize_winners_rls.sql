-- Helper function to check if a user is an organizer for the event a project was submitted to
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_project_event_organizer(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.projects p
    INNER JOIN public.user_event_roles uer 
      ON p.event_id = uer.event_id
    WHERE p.id = p_project_id
      AND uer.user_id = p_user_id 
      AND uer.role = 'organizer'
  );
END;
$$;

-- Enable RLS on prize_winners table
ALTER TABLE public.prize_winners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "prize_winners_select_public" ON public.prize_winners;
DROP POLICY IF EXISTS "prize_winners_insert_organizer" ON public.prize_winners;
DROP POLICY IF EXISTS "prize_winners_update_organizer" ON public.prize_winners;
DROP POLICY IF EXISTS "prize_winners_delete_organizer" ON public.prize_winners;
DROP POLICY IF EXISTS "Anyone can view all prize winners" ON public.prize_winners;
DROP POLICY IF EXISTS "Event organizers can assign prizes to projects from their events" ON public.prize_winners;
DROP POLICY IF EXISTS "Event organizers can update prize assignments for projects from their events" ON public.prize_winners;
DROP POLICY IF EXISTS "Event organizers can remove prize assignments for projects from their events" ON public.prize_winners;

-- Policy: Allow everyone (including anonymous users) to view all prize winners
CREATE POLICY "Anyone can view all prize winners"
ON public.prize_winners
FOR SELECT
TO public
USING (true);

-- Policy: Allow organizers to assign prizes to projects from their events
CREATE POLICY "Event organizers can assign prizes to projects from their events"
ON public.prize_winners
FOR INSERT
TO authenticated
WITH CHECK (
  project_id IS NOT NULL 
  AND public.is_project_event_organizer(project_id, (SELECT auth.uid()))
);

-- Policy: Allow organizers to update prize assignments for projects from their events
CREATE POLICY "Event organizers can update prize assignments for projects from their events"
ON public.prize_winners
FOR UPDATE
TO authenticated
USING (
  project_id IS NOT NULL 
  AND public.is_project_event_organizer(project_id, (SELECT auth.uid()))
)
WITH CHECK (
  project_id IS NOT NULL 
  AND public.is_project_event_organizer(project_id, (SELECT auth.uid()))
);

-- Policy: Allow organizers to delete prize assignments for projects from their events
CREATE POLICY "Event organizers can remove prize assignments for projects from their events"
ON public.prize_winners
FOR DELETE
TO authenticated
USING (
  project_id IS NOT NULL 
  AND public.is_project_event_organizer(project_id, (SELECT auth.uid()))
);

