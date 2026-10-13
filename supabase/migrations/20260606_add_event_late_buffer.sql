-- Late submission buffer: a grace period (minutes) after submission_time_cutoff
-- during which submissions still go through but are flagged as late.
-- 0 (default) preserves the legacy hard-cutoff behavior. App layer enforces
-- the 0–60 range; we keep the DB column unconstrained so future tuning
-- doesn't require another migration.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS submission_late_buffer_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN events.submission_late_buffer_minutes IS
  'Grace period (minutes) after submission_time_cutoff during which submissions still go through but are flagged as late. 0 = hard cutoff (legacy behavior). Range enforced in app layer: 0–60.';
