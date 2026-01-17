CREATE TABLE IF NOT EXISTS meeting_screen_context (
  meeting_id text PRIMARY KEY,
  summary text,
  updated_at timestamptz DEFAULT now(),
  last_frame_ts timestamptz
);