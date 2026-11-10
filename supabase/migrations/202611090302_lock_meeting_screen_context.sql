-- Only service-role code (/api/call/vision and the worker) uses this table, and
-- it bypasses RLS, so no client policy is needed.
ALTER TABLE IF EXISTS public.meeting_screen_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select" ON public.meeting_screen_context;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.meeting_screen_context;
