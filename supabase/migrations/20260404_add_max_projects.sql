-- Add max_projects cap to events table
-- null = unlimited (default), integer = maximum number of submitted projects allowed

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_projects INTEGER;

COMMENT ON COLUMN events.max_projects IS
  'Maximum number of submitted projects allowed for this event. NULL = unlimited.';
