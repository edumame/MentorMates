-- Add setting to hide submitted projects from the public gallery until after the submission deadline
-- When enabled, projects are only visible to the owner, organizers, and judges until submission_time_cutoff passes

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS hide_gallery_until_deadline BOOLEAN DEFAULT false;
