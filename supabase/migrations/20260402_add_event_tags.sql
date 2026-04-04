-- Convert event_type from TEXT to TEXT[] (array of tags)
-- Preserves existing values by wrapping them in an array

DO $$
BEGIN
  -- Only run conversion when the column is currently scalar text.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'event_type'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE events
      ALTER COLUMN event_type TYPE TEXT[]
      USING CASE
        WHEN event_type IS NOT NULL THEN ARRAY[event_type]
        ELSE ARRAY[]::TEXT[]
      END;

    ALTER TABLE events
      ALTER COLUMN event_type SET DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Index for searching by tag
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events USING GIN (event_type);
