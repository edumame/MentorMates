-- Audit + rate-limit log for organizer SMS blasts
CREATE TABLE IF NOT EXISTS sms_blasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    sent_by UUID REFERENCES user_profiles(uid) ON DELETE SET NULL,
    message TEXT NOT NULL,
    recipient_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_blasts_event_created
    ON sms_blasts(event_id, created_at DESC);

ALTER TABLE sms_blasts ENABLE ROW LEVEL SECURITY;

-- Only event organizers can read their event's blast history (rate-limit UI needs this).
CREATE POLICY "Organizers can view sms blasts for their event"
ON sms_blasts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles
        WHERE user_event_roles.event_id = sms_blasts.event_id
          AND user_event_roles.user_id = auth.uid()
          AND user_event_roles.role IN ('organizer', 'admin')
    )
);

-- Writes happen via the API using the service role; no client insert policy needed.

COMMENT ON TABLE sms_blasts IS 'Audit log of organizer SMS broadcasts. Backs the 6h-per-event rate limit.';
