-- Add event_lessons JSONB column to events table to store exclusive lessons
-- Each lesson contains: title, cover_image_url, url, description, duration_minutes

BEGIN;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_lessons JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.event_lessons IS 'Exclusive lessons for participants: [{title, cover_image_url, url, description, duration_minutes}]';

COMMIT;
