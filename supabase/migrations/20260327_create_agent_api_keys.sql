-- Agent API keys for Claude Code skill integration
-- Each key is scoped to a user + event, with organizer-level access

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display (e.g., "mm_sk_ab12...")
  label TEXT DEFAULT 'default',
  scopes TEXT[] DEFAULT ARRAY['event:read', 'event:write', 'participants:read', 'participants:write', 'projects:read', 'projects:write'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key_hash)
);

-- Index for fast lookup by hash
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash);
-- Index for listing keys by user
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_user ON agent_api_keys(user_id, event_id);

-- RLS: users can only see their own keys
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON agent_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON agent_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON agent_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON agent_api_keys FOR DELETE
  USING (auth.uid() = user_id);
