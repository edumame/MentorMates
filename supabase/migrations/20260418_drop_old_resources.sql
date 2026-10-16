-- ⚠️  DESTRUCTIVE — run ONLY after all code paths are confirmed switched
-- to the new event_resources table. This is a one-way migration.
--
-- Checklist before running:
-- [ ] ResourcesTab.tsx reads/writes event_resources table (not events.event_resources JSONB)
-- [ ] ContentTab.tsx reads/writes event_resources table (not event_lessons)
-- [ ] Wizard buildApiPayload inserts into event_resources table
-- [ ] Overview page fetches from event_resources table
-- [ ] Agent API uses event_resources table
-- [ ] All tests pass
-- [ ] Verified on staging

DROP TABLE IF EXISTS event_lessons;
ALTER TABLE events DROP COLUMN IF EXISTS event_resources;
