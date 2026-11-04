-- The anon key is public, so PostgREST reaches public.feedback directly. These
-- policies, not only /api/feedback/submit, must bind a row to its real sender
-- and to a project the caller can see:
--   * mentor_id is the caller, or NULL for an anonymous caller.
--   * An anonymous row carries no mentor_name or mentor_email.
--   * A signed-in row's mentor_name and mentor_email come from auth.users, set
--     by the trigger at the end of this file. Project pages, the team dashboard
--     and the organizer export show those columns without consulting mentor_id.
--   * The project exists and is visible to the caller. event_id IS NULL no
--     longer skips this check.
--   * event_id is the project's event, so judge-stats, which counts rows by
--     event_id and mentor_id, can't be credited for another event.
-- can_view_project allows public projects for everyone, including a NULL user.

-- Permissive policies combine with OR, so any INSERT policy left over under a
-- different name in production would defeat the one created below.
DO $$
DECLARE
  insert_policy record;
BEGIN
  FOR insert_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedback', insert_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Event participants can submit feedback for projects in their events"
ON public.feedback
FOR INSERT
WITH CHECK (
  mentor_id IS NOT DISTINCT FROM (SELECT auth.uid())
  AND (
    (SELECT auth.uid()) IS NOT NULL
    OR (mentor_name IS NULL AND mentor_email IS NULL)
  )
  AND project_id IS NOT NULL
  AND public.can_view_project(project_id, (SELECT auth.uid()))
  AND feedback.event_id IS NOT DISTINCT FROM (
    SELECT p.event_id FROM public.projects p WHERE p.id = feedback.project_id
  )
);

-- Without the same project checks here, a mentor could insert on a project they
-- can see and then move their own row onto one they can't.
DROP POLICY IF EXISTS "feedback_update_mentor" ON public.feedback;
DROP POLICY IF EXISTS "Mentors can edit their own feedback" ON public.feedback;

CREATE POLICY "Mentors can edit their own feedback"
ON public.feedback
FOR UPDATE
TO authenticated
USING (
  mentor_id = (SELECT auth.uid())
)
WITH CHECK (
  mentor_id = (SELECT auth.uid())
  AND project_id IS NOT NULL
  AND public.can_view_project(project_id, (SELECT auth.uid()))
  AND feedback.event_id IS NOT DISTINCT FROM (
    SELECT p.event_id FROM public.projects p WHERE p.id = feedback.project_id
  )
);

-- BEFORE triggers run ahead of the WITH CHECK above, so a forged mentor_id is
-- still rejected there. This reads auth.users rather than the JWT because the
-- route's getUser() is fresher than the token, and a policy comparing the two
-- would reject a legitimate submit just after a rename.
CREATE OR REPLACE FUNCTION public.bind_feedback_sender_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  -- No session: an anonymous caller, held to NULL by the INSERT policy, or the
  -- service role and migrations, which are trusted to write these columns.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- The sender is fixed at insert. Keeping the stored values means an edit can
  -- neither forge them nor stamp the editor's identity onto the row.
  IF TG_OP = 'UPDATE' THEN
    NEW.mentor_name := OLD.mentor_name;
    NEW.mentor_email := OLD.mentor_email;
    RETURN NEW;
  END IF;

  -- With no matching user, SELECT INTO sets both columns to NULL.
  SELECT nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.email, '')
  INTO NEW.mentor_name, NEW.mentor_email
  FROM auth.users u
  WHERE u.id = caller;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bind_feedback_sender_columns ON public.feedback;

CREATE TRIGGER bind_feedback_sender_columns
BEFORE INSERT OR UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.bind_feedback_sender_columns();
