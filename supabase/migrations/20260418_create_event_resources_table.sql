-- Consolidate event content (links, lessons, sponsors, tools) into a single
-- typed table. Replaces: events.event_resources JSONB + event_lessons table.
-- See issue #737.

CREATE TABLE IF NOT EXISTS event_resources (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  type            TEXT NOT NULL,  -- 'link' | 'lesson' | 'sponsor' | 'tool'
  name            TEXT NOT NULL,
  description     TEXT,
  url             TEXT,
  cover_image_url TEXT,
  sort_order      INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_resources_event_id ON event_resources(event_id);
CREATE INDEX idx_event_resources_type ON event_resources(event_id, type);

-- RLS: same pattern as event_lessons (read = event members, write = organizers/admins)
ALTER TABLE event_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_resources_select" ON event_resources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_event_roles
      WHERE user_event_roles.event_id = event_resources.event_id
        AND user_event_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "event_resources_insert" ON event_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_event_roles
      WHERE user_event_roles.event_id = event_resources.event_id
        AND user_event_roles.user_id = auth.uid()
        AND user_event_roles.role IN ('organizer', 'admin')
    )
  );

CREATE POLICY "event_resources_update" ON event_resources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_event_roles
      WHERE user_event_roles.event_id = event_resources.event_id
        AND user_event_roles.user_id = auth.uid()
        AND user_event_roles.role IN ('organizer', 'admin')
    )
  );

CREATE POLICY "event_resources_delete" ON event_resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_event_roles
      WHERE user_event_roles.event_id = event_resources.event_id
        AND user_event_roles.user_id = auth.uid()
        AND user_event_roles.role IN ('organizer', 'admin')
    )
  );
