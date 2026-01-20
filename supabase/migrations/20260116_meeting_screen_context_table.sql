CREATE TABLE IF NOT EXISTS meeting_screen_context (
  meeting_id text PRIMARY KEY,
  summary text,
  updated_at timestamptz DEFAULT now(),
  last_frame_ts timestamptz
);

-- Enable row level security and allow authenticated users to SELECT and INSERT
ALTER TABLE meeting_screen_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select" ON meeting_screen_context
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert" ON meeting_screen_context
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);