-- Apply before deploying the /api/translate quota check (reserve_translation_request).
-- Mirrors 202610200001_scraper_request_quota.sql: a service-only table plus an
-- atomic reservation RPC. Only cache misses (paid OpenAI calls) reserve quota.
-- Limits: 30 cache-miss translations and 100,000 source characters per verified
-- user per UTC clock hour. Keep the CHECK constraints in sync with the constants.
BEGIN;
CREATE TABLE public.translation_request_quota (
  user_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 30),
  char_count integer NOT NULL CHECK (char_count BETWEEN 1 AND 100000)
);
ALTER TABLE public.translation_request_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.translation_request_quota FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_request_quota TO service_role;

CREATE FUNCTION public.reserve_translation_request(p_user_id uuid, p_char_count integer)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  max_requests_per_hour CONSTANT integer := 30;
  max_chars_per_hour CONSTANT integer := 100000;
  max_chars_per_request CONSTANT integer := 10000;
  current_window timestamptz := date_trunc('hour', statement_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  reserved_count integer;
  effective_window timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A verified user ID is required' USING ERRCODE = '22023';
  END IF;
  IF p_char_count IS NULL OR p_char_count < 1 OR p_char_count > max_chars_per_request THEN
    RAISE EXCEPTION 'Character count must be between 1 and %', max_chars_per_request USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.translation_request_quota AS quota (user_id, window_start, request_count, char_count)
  VALUES (p_user_id, current_window, 1, p_char_count)
  ON CONFLICT (user_id) DO UPDATE
    SET window_start = greatest(quota.window_start, EXCLUDED.window_start),
        request_count = CASE
          WHEN quota.window_start < EXCLUDED.window_start THEN 1
          ELSE quota.request_count + 1
        END,
        char_count = CASE
          WHEN quota.window_start < EXCLUDED.window_start THEN EXCLUDED.char_count
          ELSE quota.char_count + EXCLUDED.char_count
        END
    WHERE quota.window_start < EXCLUDED.window_start
      OR (quota.request_count < max_requests_per_hour
          AND quota.char_count + EXCLUDED.char_count <= max_chars_per_hour)
  RETURNING request_count INTO reserved_count;

  IF reserved_count IS NULL THEN
    SELECT quota.window_start INTO effective_window
    FROM public.translation_request_quota AS quota WHERE quota.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT reserved_count IS NOT NULL,
    CASE WHEN reserved_count IS NOT NULL THEN 0
      ELSE least(3600, greatest(1, ceil(extract(epoch FROM effective_window + interval '1 hour' - clock_timestamp()))::integer))
    END;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_translation_request(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_translation_request(uuid, integer) TO service_role;
COMMENT ON FUNCTION public.reserve_translation_request(uuid, integer) IS
  'Service-only atomic reservation for /api/translate cache misses; 30 requests and 100,000 source characters per verified user per UTC clock hour. Failed OpenAI calls consume reservations.';
COMMIT;
