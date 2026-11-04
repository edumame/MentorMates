-- A prize or round advancement only counts for the event it was awarded in.
--
-- 1. prize_winners writes follow the prize's event. They used to follow the
--    project's current event, so once a project moved, the organizer who
--    awarded the prize could no longer remove it (the delete matched 0 rows).
-- 2. A trigger refuses to move a project that holds a prize or advancement,
--    and refuses a move into an event the acting user has no role in. RLS
--    cannot compare old and new values, and the projects UPDATE policy lets any
--    project member write event_id directly, so this has to be a trigger.
--
-- Existing rows are left alone. The app ignores rows from another event, and
-- the awarding organizer can now remove them.

CREATE OR REPLACE FUNCTION public.is_prize_event_organizer(p_prize_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.prizes pr
    INNER JOIN public.event_tracks et
      ON et.track_id = pr.track_id
    INNER JOIN public.user_event_roles uer
      ON uer.event_id = et.event_id
    WHERE pr.id = p_prize_id
      AND uer.user_id = p_user_id
      AND uer.role = 'organizer'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_project_in_prize_event(p_prize_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.prizes pr
    INNER JOIN public.event_tracks et
      ON et.track_id = pr.track_id
    INNER JOIN public.projects p
      ON p.event_id = et.event_id
    WHERE pr.id = p_prize_id
      AND p.id = p_project_id
  );
END;
$$;

-- Policy names may differ on production, and permissive policies are OR'd, so
-- a leftover write policy would keep the old behaviour. Drop every one of them.
DO $$
DECLARE
  write_policy record;
BEGIN
  FOR write_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prize_winners'
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.prize_winners', write_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "prize_winners_insert_prize_event_organizer"
ON public.prize_winners
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_prize_event_organizer(prize_id, (SELECT auth.uid()))
  AND public.is_project_in_prize_event(prize_id, project_id)
);

CREATE POLICY "prize_winners_update_prize_event_organizer"
ON public.prize_winners
FOR UPDATE
TO authenticated
USING (
  public.is_prize_event_organizer(prize_id, (SELECT auth.uid()))
)
WITH CHECK (
  public.is_prize_event_organizer(prize_id, (SELECT auth.uid()))
  AND public.is_project_in_prize_event(prize_id, project_id)
);

CREATE POLICY "prize_winners_delete_prize_event_organizer"
ON public.prize_winners
FOR DELETE
TO authenticated
USING (
  public.is_prize_event_organizer(prize_id, (SELECT auth.uid()))
);

-- SECURITY DEFINER because participants cannot read round advancements.
-- SQLSTATE MM001 is mapped to a 409 by lib/projects/submission-service.ts.
CREATE OR REPLACE FUNCTION public.guard_project_event_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM public.prize_winners WHERE project_id = NEW.id) THEN
    RAISE EXCEPTION 'A project that has won a prize cannot be moved to another event'
      USING ERRCODE = 'MM001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.project_round_advancements WHERE project_id = NEW.id) THEN
    RAISE EXCEPTION 'A project that has advanced in judging cannot be moved to another event'
      USING ERRCODE = 'MM001';
  END IF;

  -- No auth.uid() means a service role or database session, not a signed-in user.
  IF v_actor IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = NEW.event_id
      AND user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'You must be part of an event to move a project into it'
      USING ERRCODE = 'MM001';
  END IF;

  RETURN NEW;
END;
$$;

-- NEW.event_id IS NOT NULL keeps event deletion working: projects.event_id is
-- ON DELETE SET NULL, and that update must not be refused. Re-attaching a
-- detached project is still a move, so this cannot be used to get around the guard.
DROP TRIGGER IF EXISTS guard_project_event_move ON public.projects;
CREATE TRIGGER guard_project_event_move
BEFORE UPDATE OF event_id ON public.projects
FOR EACH ROW
WHEN (NEW.event_id IS NOT NULL AND OLD.event_id IS DISTINCT FROM NEW.event_id)
EXECUTE FUNCTION public.guard_project_event_move();
