-- Create project_votes table for event-specific voting with 3-vote limit per user
CREATE TABLE IF NOT EXISTS project_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only vote once per project
  UNIQUE(project_id, user_id)
);

-- Index for fast vote counting per event per user (for 3-vote limit check)
CREATE INDEX IF NOT EXISTS idx_project_votes_user_event ON project_votes(user_id, event_id);

-- Index for fast vote counting per project
CREATE INDEX IF NOT EXISTS idx_project_votes_project ON project_votes(project_id);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_project_votes_event ON project_votes(event_id);

-- RLS policies
ALTER TABLE project_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view vote counts (for displaying on cards)
CREATE POLICY "Anyone can view project votes"
  ON project_votes
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Users can insert their own votes"
  ON project_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON project_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comment describing the table
COMMENT ON TABLE project_votes IS 'Stores project votes for events. Each user can vote for up to 3 projects per event.';
