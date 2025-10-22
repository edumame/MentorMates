-- Create event_lessons table to store exclusive lessons per event
-- Each lesson belongs to an event and has metadata used across the app

BEGIN;

-- Table
CREATE TABLE IF NOT EXISTS public.event_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_image_url TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_event_lessons_updated_at ON public.event_lessons;
CREATE TRIGGER update_event_lessons_updated_at
BEFORE UPDATE ON public.event_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_event_lessons_event_id ON public.event_lessons(event_id);

-- RLS
ALTER TABLE public.event_lessons ENABLE ROW LEVEL SECURITY;

-- Policies
-- Read: allow authenticated users to read lessons for events they have joined/are part of
CREATE POLICY "read_event_lessons_for_event_members"
ON public.event_lessons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = auth.uid()
  )
);

-- Insert/Update/Delete: only organizers/admins of the event
CREATE POLICY "modify_event_lessons_for_organizers"
ON public.event_lessons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = auth.uid()
      AND uer.role IN ('organizer','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = auth.uid()
      AND uer.role IN ('organizer','admin')
  )
);

COMMIT;
