-- Make event_id nullable in feedback table
-- Projects can exist independently without being tied to an event

ALTER TABLE feedback
ALTER COLUMN event_id DROP NOT NULL;

-- Add comment explaining why this is nullable
COMMENT ON COLUMN feedback.event_id IS 'Optional event reference - projects can be created independently of events';
