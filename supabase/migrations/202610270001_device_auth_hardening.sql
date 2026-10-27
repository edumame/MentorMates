-- Device authorization (RFC 8628) hardening. Apply after
-- 20260419_create_device_auth_codes.sql and 202610120002_secure_device_auth_codes.sql,
-- and before deploying the device auth routes that call reserve_device_auth_attempt.
--
-- 1. Adds an intermediate 'approving' status so the approve endpoint can claim a
--    pending row with a conditional UPDATE before minting an API key. Exactly one
--    concurrent approval wins the claim; the others see zero rows updated.
-- 2. Adds a service-only fixed-window attempt counter used to rate limit
--    unauthenticated code creation (per hashed client IP) and approval attempts
--    (per verified user).
BEGIN;

ALTER TABLE public.device_auth_codes
  DROP CONSTRAINT IF EXISTS device_auth_codes_status_check;
ALTER TABLE public.device_auth_codes
  ADD CONSTRAINT device_auth_codes_status_check
  CHECK (status IN ('pending', 'approving', 'approved', 'expired'));

CREATE TABLE public.device_auth_rate_limits (
  bucket text PRIMARY KEY CHECK (char_length(bucket) BETWEEN 1 AND 200),
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  attempt_count integer NOT NULL CHECK (attempt_count >= 1)
);
CREATE INDEX idx_device_auth_rate_limits_window_start
  ON public.device_auth_rate_limits (window_start);

ALTER TABLE public.device_auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_auth_rate_limits TO service_role;

CREATE FUNCTION public.reserve_device_auth_attempt(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  now_ts timestamptz := statement_timestamp();
  reserved_count integer;
  effective_window timestamptz;
BEGIN
  IF p_bucket IS NULL OR char_length(p_bucket) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'A rate limit bucket is required' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_seconds IS NULL
     OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration' USING ERRCODE = '22023';
  END IF;

  -- Opportunistic cleanup keeps the table bounded (indexed on window_start).
  DELETE FROM public.device_auth_rate_limits AS stale
  WHERE stale.window_start < now_ts - interval '1 day';

  INSERT INTO public.device_auth_rate_limits AS rl
    (bucket, window_start, window_seconds, attempt_count)
  VALUES (p_bucket, now_ts, p_window_seconds, 1)
  ON CONFLICT (bucket) DO UPDATE
    SET window_start = CASE
          WHEN rl.window_start + make_interval(secs => rl.window_seconds) <= now_ts
            THEN EXCLUDED.window_start
          ELSE rl.window_start
        END,
        window_seconds = EXCLUDED.window_seconds,
        attempt_count = CASE
          WHEN rl.window_start + make_interval(secs => rl.window_seconds) <= now_ts
            THEN 1
          ELSE rl.attempt_count + 1
        END
    WHERE rl.window_start + make_interval(secs => rl.window_seconds) <= now_ts
       OR rl.attempt_count < p_limit
  RETURNING attempt_count INTO reserved_count;

  IF reserved_count IS NULL THEN
    SELECT rl.window_start + make_interval(secs => rl.window_seconds)
      INTO effective_window
    FROM public.device_auth_rate_limits AS rl
    WHERE rl.bucket = p_bucket;
  END IF;

  RETURN QUERY SELECT
    reserved_count IS NOT NULL,
    CASE WHEN reserved_count IS NOT NULL THEN 0
      ELSE least(86400, greatest(1,
        ceil(extract(epoch FROM effective_window - clock_timestamp()))::integer))
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_device_auth_attempt(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_device_auth_attempt(text, integer, integer)
  TO service_role;
COMMENT ON FUNCTION public.reserve_device_auth_attempt(text, integer, integer) IS
  'Service-only atomic fixed-window attempt reservation for device authorization (code creation per hashed IP, approval per user).';

COMMIT;
