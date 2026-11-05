-- Keep role password hashes server-side only.
--
-- The join dialog still needs to know which roles have a password, so the
-- existing SELECT policy stays and authenticated keeps SELECT on event_id and
-- role only.
-- /api/roles/verify and /api/roles/set-password use the service role for
-- password_hash. Deploy those routes before applying this migration.
--
-- Revoking table-level SELECT also removes any column-level SELECT grants, so
-- this is safe to re-run. Organizer INSERT/UPDATE/DELETE policies are unchanged.
DO $$
BEGIN
  IF to_regclass('public.role_passwords') IS NULL THEN
    RETURN;
  END IF;

  REVOKE SELECT ON TABLE public.role_passwords FROM PUBLIC, anon, authenticated;
  GRANT SELECT (event_id, role) ON TABLE public.role_passwords TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_passwords TO service_role;
END;
$$;
