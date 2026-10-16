-- Device credentials are service-only. Authentication in API handlers does not
-- protect direct Data API access to a table with public client grants.
ALTER TABLE public.device_auth_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_auth_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_auth_codes TO service_role;
