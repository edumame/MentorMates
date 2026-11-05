-- Only projects eligible for a judging round can be scored in that round.
--
-- Mirrors getProjectIdsForRound in lib/judging/rounds.ts:
--   * a round with advancement rows contains exactly those projects;
--   * round 1 with no advancement rows contains every submitted project;
--   * any other round contains nothing.
-- A caller with the judge role must also be assigned to the project. Organizers
-- and server-side writes are not assignment-bound.
--
-- Existing rows are left alone, so scores for a project later dropped from a
-- round come back if the organizer re-adds it. The Scores tab hides them in the
-- meantime. DELETE is not checked, so stale scores can still be removed.
--
-- SECURITY DEFINER so the check sees advancements, assignments and draft
-- projects regardless of what the caller's RLS policies expose.
CREATE OR REPLACE FUNCTION public.validate_score_round_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligible boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.project_round_advancements
    WHERE event_id = NEW.event_id
      AND round_number = NEW.round_number
  ) THEN
    v_eligible := EXISTS (
      SELECT 1
      FROM public.project_round_advancements
      WHERE event_id = NEW.event_id
        AND round_number = NEW.round_number
        AND project_id = NEW.project_id
    );
  ELSIF NEW.round_number = 1 THEN
    v_eligible := EXISTS (
      SELECT 1
      FROM public.projects
      WHERE id = NEW.project_id
        AND event_id = NEW.event_id
        AND submitted IS TRUE
    );
  ELSE
    v_eligible := false;
  END IF;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'Project is not eligible for judging round %', NEW.round_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = NEW.event_id
      AND user_id = (SELECT auth.uid())
      AND role = 'judge'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.project_assignments
    WHERE event_id = NEW.event_id
      AND project_id = NEW.project_id
      AND user_id = (SELECT auth.uid())
      AND role = 'judge'
  ) THEN
    RAISE EXCEPTION 'Judge is not assigned to this project'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_score_round_eligibility ON public.project_scores;
CREATE TRIGGER validate_score_round_eligibility
BEFORE INSERT OR UPDATE ON public.project_scores
FOR EACH ROW
EXECUTE FUNCTION public.validate_score_round_eligibility();
