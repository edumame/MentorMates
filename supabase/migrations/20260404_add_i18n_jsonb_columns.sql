-- i18n JSONB columns for short user-generated text fields
-- Phase 3 of the multi-language support rollout (#659)
--
-- Each *_i18n column stores a map of locale → localized text, e.g.:
--   { "en": "AI Hackathon", "zh": "AI黑客马拉松", "es": "Hackathon de IA" }
--
-- The original non-i18n columns remain as the fallback for locales that
-- don't have a translation. Reads should use getLocalizedField() which
-- checks _i18n[locale] first, then falls back to the original column.

-- Events table: event_name and event_blurb
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_name_i18n JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS event_blurb_i18n JSONB DEFAULT '{}'::jsonb;

-- Event tracks: name and description
ALTER TABLE event_tracks
  ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- GIN indexes for querying by locale content (optional but cheap)
CREATE INDEX IF NOT EXISTS idx_events_event_name_i18n ON events USING GIN (event_name_i18n);
CREATE INDEX IF NOT EXISTS idx_events_event_blurb_i18n ON events USING GIN (event_blurb_i18n);
CREATE INDEX IF NOT EXISTS idx_event_tracks_name_i18n ON event_tracks USING GIN (name_i18n);

COMMENT ON COLUMN events.event_name_i18n IS 'Map of locale code to localized event name. Fallback to event_name when missing.';
COMMENT ON COLUMN events.event_blurb_i18n IS 'Map of locale code to localized event blurb. Fallback to event_blurb when missing.';
COMMENT ON COLUMN event_tracks.name_i18n IS 'Map of locale code to localized track name. Fallback to name when missing.';
COMMENT ON COLUMN event_tracks.description_i18n IS 'Map of locale code to localized track description. Fallback to description when missing.';
