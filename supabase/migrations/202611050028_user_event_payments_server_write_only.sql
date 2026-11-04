-- Make user_event_payments server-write-only, as 20251028_user_event_payments_rls.sql
-- intended. This removes the 20250620 INSERT and UPDATE policies it left in place.
--
-- Deploy the application change first: fetchClientSecret must already write through
-- the service client, or checkout fails once these policies are gone.
--
-- Idempotent. The REVOKE also covers production policies under other names, because
-- production migration history is empty and its schema may differ from this repo.
-- Read access is unchanged. service_role bypasses RLS and keeps its grants.
DO $$
BEGIN
  IF to_regclass('public.user_event_payments') IS NULL THEN
    RAISE NOTICE 'public.user_event_payments does not exist; skipping';
    RETURN;
  END IF;

  ALTER TABLE public.user_event_payments ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can create own payments" ON public.user_event_payments;
  DROP POLICY IF EXISTS "Users can update own payments" ON public.user_event_payments;

  REVOKE INSERT, UPDATE, DELETE ON public.user_event_payments FROM anon, authenticated;
END
$$;
