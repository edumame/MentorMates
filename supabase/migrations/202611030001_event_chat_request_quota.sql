-- Apply before deploying the /events/new chat: POST /api/events/chat-draft
-- calls reserve_event_chat_request on every turn and fails closed without it.
-- This additive migration does not depend on application tables.
BEGIN;
CREATE TABLE public.event_chat_request_quota (
  quota_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1)
);
ALTER TABLE public.event_chat_request_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_chat_request_quota FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_chat_request_quota TO service_role;

CREATE FUNCTION public.reserve_event_chat_request(p_user_id uuid)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_window timestamptz := date_trunc('hour', statement_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  entry record;
  reserved_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A verified user ID is required' USING ERRCODE = '22023';
  END IF;

  -- Per user first, so a user at their limit does not use up the global budget.
  FOR entry IN
    SELECT * FROM (VALUES ('user:' || p_user_id::text, 60), ('global', 2000)) AS limits(key, max_count)
  LOOP
    reserved_count := NULL;
    INSERT INTO public.event_chat_request_quota AS quota (quota_key, window_start, request_count)
    VALUES (entry.key, current_window, 1)
    ON CONFLICT (quota_key) DO UPDATE
      SET window_start = greatest(quota.window_start, EXCLUDED.window_start),
          request_count = CASE
            WHEN quota.window_start < EXCLUDED.window_start THEN 1
            ELSE quota.request_count + 1
          END
      WHERE quota.window_start < EXCLUDED.window_start OR quota.request_count < entry.max_count
    RETURNING request_count INTO reserved_count;

    IF reserved_count IS NULL THEN
      RETURN QUERY SELECT false,
        least(3600, greatest(1, ceil(extract(epoch FROM current_window + interval '1 hour' - clock_timestamp()))::integer));
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT true, 0;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_event_chat_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_event_chat_request(uuid) TO service_role;
COMMENT ON FUNCTION public.reserve_event_chat_request(uuid) IS
  'Service-only atomic reservation for the event creation chat: 60 turns per verified user and 2000 overall per UTC clock hour.';
COMMIT;
