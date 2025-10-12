-- Add owner_id column to events table
ALTER TABLE events ADD COLUMN owner_id UUID;

-- Add foreign key constraint to user_profiles
ALTER TABLE events ADD CONSTRAINT events_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES user_profiles(uid)
  ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_events_owner_id ON events(owner_id);

-- Add comment
COMMENT ON COLUMN events.owner_id IS 'The user who created/owns this event';
