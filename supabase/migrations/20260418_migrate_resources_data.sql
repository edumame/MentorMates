-- Migrate existing event_lessons rows and events.event_resources JSONB entries
-- into the new event_resources table. Runs AFTER 20260418_create_event_resources_table.sql.
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING (no unique constraint needed
-- because source data can't produce duplicate UUIDs).

-- 1. Migrate event_lessons → event_resources (type = 'lesson')
INSERT INTO event_resources (event_id, type, name, description, url, cover_image_url, metadata, created_at)
SELECT
  event_id,
  'lesson',
  title,
  description,
  url,
  cover_image_url,
  jsonb_build_object('duration_minutes', duration_minutes),
  COALESCE(created_at, now())
FROM event_lessons;

-- 2. Migrate events.event_resources JSONB → event_resources rows (type = 'link')
INSERT INTO event_resources (event_id, type, name, url, sort_order)
SELECT
  e.event_id,
  'link',
  r->>'name',
  r->>'link',
  (idx - 1)::INTEGER
FROM events e,
     jsonb_array_elements(e.event_resources) WITH ORDINALITY AS arr(r, idx)
WHERE e.event_resources IS NOT NULL
  AND jsonb_typeof(e.event_resources) = 'array'
  AND jsonb_array_length(e.event_resources) > 0;
