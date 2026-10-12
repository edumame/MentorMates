-- Add read status tracking to feedback table
-- This allows users to mark feedback as read/unread

-- Create a table to track which users have read which feedback
CREATE TABLE IF NOT EXISTS feedback_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_read_status_user_id ON feedback_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_read_status_feedback_id ON feedback_read_status(feedback_id);

-- Enable RLS
ALTER TABLE feedback_read_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own read status
CREATE POLICY "Users can view their own read status"
  ON feedback_read_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own read status
CREATE POLICY "Users can mark feedback as read"
  ON feedback_read_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own read status
CREATE POLICY "Users can update their own read status"
  ON feedback_read_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own read status
CREATE POLICY "Users can unmark feedback as read"
  ON feedback_read_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE feedback_read_status IS 'Tracks which users have read which feedback items';
