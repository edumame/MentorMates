-- Device Authorization Flow (RFC 8628) for agent skill auth.
-- Replaces manual API key copy-paste with: enter code in browser → auto-link.
-- See issue #745.

CREATE TABLE IF NOT EXISTS device_auth_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash      TEXT NOT NULL UNIQUE,
  user_code             TEXT NOT NULL UNIQUE,
  user_id               UUID REFERENCES user_profiles(uid) ON DELETE SET NULL,
  access_mode           TEXT NOT NULL DEFAULT 'participant'
                          CHECK (access_mode IN ('organizer', 'participant')),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'expired')),
  api_key_id            UUID REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  api_key_raw_encrypted TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  last_polled_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_device_auth_user_code ON device_auth_codes(user_code);
CREATE INDEX idx_device_auth_pending ON device_auth_codes(status, expires_at)
  WHERE status = 'pending';

-- No RLS: all endpoints use service client (unauthenticated device
-- endpoints + server-side approval with Supabase Auth session).
