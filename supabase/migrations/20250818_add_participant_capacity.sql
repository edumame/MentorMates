-- Add an optional participant capacity to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS participant_capacity integer;

COMMENT ON COLUMN public.events.participant_capacity IS 'Maximum number of participants allowed to join this event. NULL means unlimited.';
