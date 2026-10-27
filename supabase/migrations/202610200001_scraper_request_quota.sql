-- Apply before deploying scraper routes that call reserve_scraper_request.
-- This additive migration does not depend on application tables.
BEGIN;
CREATE TABLE public.scraper_request_quota (
  user_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 5)
);
ALTER TABLE public.scraper_request_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scraper_request_quota FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraper_request_quota TO service_role;

CREATE FUNCTION public.reserve_scraper_request(p_user_id uuid)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_window timestamptz := date_trunc('hour', statement_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  reserved_count integer;
  effective_window timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A verified user ID is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scraper_request_quota AS quota (user_id, window_start, request_count)
  VALUES (p_user_id, current_window, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_start = greatest(quota.window_start, EXCLUDED.window_start),
        request_count = CASE
          WHEN quota.window_start < EXCLUDED.window_start THEN 1
          ELSE quota.request_count + 1
        END
    WHERE quota.window_start < EXCLUDED.window_start OR quota.request_count < 5
  RETURNING request_count INTO reserved_count;

  IF reserved_count IS NULL THEN
    SELECT quota.window_start INTO effective_window
    FROM public.scraper_request_quota AS quota WHERE quota.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT reserved_count IS NOT NULL,
    CASE WHEN reserved_count IS NOT NULL THEN 0
      ELSE least(3600, greatest(1, ceil(extract(epoch FROM effective_window + interval '1 hour' - clock_timestamp()))::integer))
    END;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_scraper_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_scraper_request(uuid) TO service_role;
COMMENT ON FUNCTION public.reserve_scraper_request(uuid) IS
  'Service-only atomic reservation, shared by both scraper endpoints; five attempts per verified user per UTC clock hour. Failed upstream calls consume reservations.';
COMMIT;
