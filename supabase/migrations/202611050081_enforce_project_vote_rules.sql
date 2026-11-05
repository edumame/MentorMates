-- Enforce the popular-vote rules in the database. RLS only checks that a voter
-- inserts their own row, and the API route's checks read then write, so they
-- can be skipped with a direct insert or beaten by concurrent requests.
--
-- A trigger rather than a stricter RLS policy because the rules read tables the
-- voter may not be able to see, and the cap needs a lock to be atomic.
--
-- Only new votes are checked. Votes already stored are left in place.

CREATE OR REPLACE FUNCTION public.enforce_project_vote_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  voter_role text;
  vote_count integer;
BEGIN
  -- Mirrors getPopularVotePermission(): any event role may vote except judge.
  SELECT role::text
  INTO voter_role
  FROM public.user_event_roles
  WHERE user_id = NEW.user_id
    AND event_id = NEW.event_id;

  IF voter_role IS NULL OR lower(voter_role) = 'judge' THEN
    RAISE EXCEPTION 'Only event members who are not judges can vote'
      USING ERRCODE = 'VT001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = NEW.project_id
      AND event_id = NEW.event_id
      AND submitted IS TRUE
  ) THEN
    RAISE EXCEPTION 'Only submitted projects in this event can receive votes'
      USING ERRCODE = 'VT002';
  END IF;

  -- Serialize one voter's inserts per event so concurrent votes cannot all read
  -- the same count. The lock is held until the transaction ends.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('project_votes:' || NEW.user_id::text || ':' || NEW.event_id::text, 0)
  );

  SELECT count(*)
  INTO vote_count
  FROM public.project_votes
  WHERE user_id = NEW.user_id
    AND event_id = NEW.event_id;

  -- Keep in step with MAX_VOTES_PER_USER in app/api/events/[eventId]/votes/route.ts.
  IF vote_count >= 3 THEN
    RAISE EXCEPTION 'You can only vote for 3 projects per event'
      USING ERRCODE = 'VT003';
  END IF;

  RETURN NEW;
END;
$$;

-- Only the trigger should run this. Firing a trigger needs no EXECUTE privilege.
REVOKE ALL ON FUNCTION public.enforce_project_vote_rules() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.project_votes') IS NULL THEN
    RAISE NOTICE 'public.project_votes does not exist; skipping vote rules trigger';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_enforce_project_vote_rules ON public.project_votes;
  CREATE TRIGGER trg_enforce_project_vote_rules
  BEFORE INSERT ON public.project_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_vote_rules();
END;
$$;
