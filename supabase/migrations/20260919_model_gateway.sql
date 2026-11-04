-- Model access is independent of event-agent permissions. Secrets are never stored.
CREATE TABLE public.model_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  key_prefix text NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
CREATE INDEX model_api_keys_user_created ON public.model_api_keys(user_id, created_at DESC, id DESC);

CREATE TABLE public.model_api_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id uuid REFERENCES public.model_api_keys(id) ON DELETE SET NULL,
  requested_model text,
  resolved_model text,
  provider text,
  request_body jsonb,
  response_body jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'succeeded', 'failed')),
  http_status integer CHECK (http_status BETWEEN 100 AND 599),
  upstream_status integer CHECK (upstream_status BETWEEN 100 AND 599),
  error_code text,
  input_tokens bigint CHECK (input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens >= 0),
  duration_ms integer CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX model_api_requests_user_history ON public.model_api_requests(user_id, created_at DESC, id DESC);
CREATE INDEX model_api_requests_key ON public.model_api_requests(key_id);

-- One row per account; rotating windows do not accumulate counter rows.
CREATE TABLE public.model_api_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_start timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0,
  day_start timestamptz NOT NULL DEFAULT now(),
  day_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.model_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_api_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_keys_owner_read ON public.model_api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY model_requests_owner_read ON public.model_api_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Only trusted server code issues/revokes keys or writes request records/counters.
REVOKE ALL ON public.model_api_keys, public.model_api_requests, public.model_api_limits FROM anon, authenticated;
GRANT SELECT (id, user_id, key_prefix, label, created_at, expires_at, revoked_at, last_used_at) ON public.model_api_keys TO authenticated;
GRANT SELECT ON public.model_api_requests TO authenticated;
GRANT ALL ON public.model_api_keys, public.model_api_requests, public.model_api_limits TO service_role;

CREATE FUNCTION public.begin_model_api_request(
  p_user_id uuid, p_key_id uuid, p_request_id uuid, p_request_body jsonb,
  p_model text, p_minute_limit integer, p_day_limit integer
) RETURNS TABLE (allowed boolean, retry_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_now timestamptz;
  v_minute timestamptz;
  v_day timestamptz;
  v_limits public.model_api_limits%ROWTYPE;
  v_expiry timestamptz;
  v_retry integer := 0;
BEGIN
  IF p_minute_limit IS NULL OR p_day_limit IS NULL OR p_minute_limit < 1 OR p_day_limit < 1 THEN
    RAISE EXCEPTION 'Invalid limits';
  END IF;
  -- Recheck after authentication to catch revocation while reading the body.
  SELECT expires_at INTO v_expiry FROM public.model_api_keys
    WHERE id = p_key_id AND user_id = p_user_id AND revoked_at IS NULL
    FOR UPDATE;
  IF NOT FOUND OR (v_expiry IS NOT NULL AND v_expiry <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Invalid model API key' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.model_api_limits(user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_limits FROM public.model_api_limits WHERE user_id = p_user_id FOR UPDATE;
  v_now := clock_timestamp();
  v_minute := date_trunc('minute', v_now);
  v_day := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF v_limits.minute_start < v_minute THEN v_limits.minute_count := 0; END IF;
  IF v_limits.day_start < v_day THEN v_limits.day_count := 0; END IF;
  IF v_limits.minute_count >= p_minute_limit THEN
    v_retry := greatest(1, ceil(extract(epoch FROM v_minute + interval '1 minute' - v_now))::integer);
  END IF;
  IF v_limits.day_count >= p_day_limit THEN
    v_retry := greatest(v_retry, ceil(extract(epoch FROM v_day + interval '1 day' - v_now))::integer);
  END IF;
  IF v_retry = 0 THEN
    UPDATE public.model_api_limits SET minute_start = v_minute, day_start = v_day,
      minute_count = v_limits.minute_count + 1, day_count = v_limits.day_count + 1
      WHERE user_id = p_user_id;
  END IF;
  INSERT INTO public.model_api_requests(id, user_id, key_id, requested_model, request_body)
    VALUES (p_request_id, p_user_id, p_key_id, p_model, p_request_body);
  UPDATE public.model_api_keys SET last_used_at = v_now WHERE id = p_key_id;
  RETURN QUERY SELECT v_retry = 0, v_retry;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_model_api_request(uuid, uuid, uuid, jsonb, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_model_api_request(uuid, uuid, uuid, jsonb, text, integer, integer) TO service_role;
