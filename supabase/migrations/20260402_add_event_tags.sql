-- Convert event_type from TEXT to TEXT[] (array of tags)
-- Preserves existing values by wrapping them in an array

ALTER TABLE events
  ALTER COLUMN event_type TYPE TEXT[]
  USING CASE
    WHEN event_type IS NOT NULL THEN ARRAY[event_type]
    ELSE '{}'::TEXT[]
  END;

ALTER TABLE events ALTER COLUMN event_type SET DEFAULT '{}';

-- Index for searching by tag
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events USING GIN (event_type);
