-- Reject judge writes to project_scores for any round but the event's active one.
--
-- Scores are written straight from the browser, and the round comes from the
-- judge's tab. A tab left open across a round change could otherwise save into
-- the old round. The scoring form checks first, so this only fires in the gap
-- between that check and the write, or for a client that skips the check.
--
-- Only the `authenticated` role is checked. Foreign-key actions, migrations and
-- service-role repairs must still be able to touch rows from earlier rounds.
-- This stays SECURITY INVOKER: under SECURITY DEFINER, current_user would be the
-- function owner and the check would never run.

CREATE OR REPLACE FUNCTION public.enforce_project_score_active_round()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_config jsonb;
  v_active_round numeric := 1;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT e.scoring_config
    INTO v_config
    FROM public.events e
   WHERE e.event_id = NEW.event_id;

  -- No readable event: leave the decision to the project_scores RLS policies.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Mirrors getActiveRound() in lib/judging/rounds.ts.
  IF jsonb_typeof(v_config -> 'activeRound') = 'number'
     AND (v_config ->> 'activeRound')::numeric > 0 THEN
    v_active_round := (v_config ->> 'activeRound')::numeric;
  END IF;

  IF NEW.round_number IS DISTINCT FROM v_active_round THEN
    RAISE EXCEPTION 'Round % is not the active judging round for this event', NEW.round_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- A trigger on a schema without these columns would fail every score write.
DO $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'project_scores'
          AND column_name = 'round_number'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'scoring_config'
          AND data_type = 'jsonb'
     ) THEN
    DROP TRIGGER IF EXISTS enforce_project_score_active_round ON public.project_scores;
    CREATE TRIGGER enforce_project_score_active_round
      BEFORE INSERT OR UPDATE ON public.project_scores
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_project_score_active_round();
  END IF;
END;
$$;
