-- Keep cached private content out of direct client table reads.
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read translations" ON public.content_translations;
REVOKE ALL ON public.content_translations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_translations TO service_role;
