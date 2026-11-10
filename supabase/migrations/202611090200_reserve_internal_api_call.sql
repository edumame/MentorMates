-- Apply before deploying the /api/internal/jev route that calls
-- reserve_internal_api_call. Until then that route answers 503 (it fails closed).
-- Requires internal_invites and internal_api_usage
-- (20260919_add_internal_invites_and_usage.sql).
BEGIN;
CREATE OR REPLACE FUNCTION public.reserve_internal_api_call(
  p_service text,
  p_key_id uuid,
  p_invite_id uuid,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  outcome text,
  usage_id bigint,
  calls_in_window integer,
  oldest_in_window timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  reserved_at timestamptz;
  recent_calls integer;
  oldest_call timestamptz;
  new_usage_id bigint;
BEGIN
  IF p_service IS NULL OR p_key_id IS NULL OR p_invite_id IS NULL THEN
    RAISE EXCEPTION 'A service, API key ID and invite ID are required' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 0 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'A valid limit and window are required' USING ERRCODE = '22023';
  END IF;

  -- One reservation per key at a time, held until commit, so the count below
  -- always includes every earlier reservation for this key.
  PERFORM pg_advisory_xact_lock(hashtextextended('internal_api_usage:' || p_key_id::text, 0));

  -- Read the clock after the lock: now() is fixed when the transaction starts.
  reserved_at := clock_timestamp();

  SELECT count(*)::integer, min(recent.created_at)
  INTO recent_calls, oldest_call
  FROM public.internal_api_usage AS recent
  WHERE recent.key_id = p_key_id
    AND recent.service = p_service
    AND recent.created_at >= reserved_at - make_interval(secs => p_window_seconds);

  IF recent_calls >= p_limit THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::bigint, recent_calls, oldest_call;
    RETURN;
  END IF;

  -- Re-check the invite here: the caller's read of it may be stale by now.
  UPDATE public.internal_invites AS invite
  SET uses = invite.uses + 1
  WHERE invite.id = p_invite_id
    AND invite.service = p_service
    AND invite.revoked_at IS NULL
    AND (invite.expires_at IS NULL OR invite.expires_at > reserved_at)
    AND (invite.max_uses IS NULL OR invite.uses < invite.max_uses);

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invite_unavailable'::text, NULL::bigint, recent_calls, oldest_call;
    RETURN;
  END IF;

  INSERT INTO public.internal_api_usage (service, key_id, invite_id, created_at)
  VALUES (p_service, p_key_id, p_invite_id, reserved_at)
  RETURNING id INTO new_usage_id;

  RETURN QUERY SELECT 'reserved'::text, new_usage_id, recent_calls, oldest_call;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_internal_api_call(text, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_internal_api_call(text, uuid, uuid, integer, integer) TO service_role;
COMMENT ON FUNCTION public.reserve_internal_api_call(text, uuid, uuid, integer, integer) IS
  'Service-only atomic reservation for internal API proxies: counts the key''s window, takes one invite use and inserts the usage row in one transaction. The caller fills in status and latency afterwards; a row with a NULL status is a call in flight or one that never reported back, and it still counts against the limit.';

-- The route now completes its reserved row with an UPDATE.
DO $$
BEGIN
  IF to_regclass('public.internal_api_usage') IS NOT NULL THEN
    GRANT UPDATE ON public.internal_api_usage TO service_role;
  END IF;
END;
$$;
COMMIT;
