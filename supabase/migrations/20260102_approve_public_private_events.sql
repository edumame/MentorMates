-- Approve all public and private events
-- This migration sets approved = true for all events that are either public or private
UPDATE public.events 
SET approved = true 
WHERE visibility IN ('public', 'private');

-- Add comment to document this change
COMMENT ON COLUMN public.events.approved IS 'Whether this event has been approved by an admin. All public and private events are auto-approved.';
