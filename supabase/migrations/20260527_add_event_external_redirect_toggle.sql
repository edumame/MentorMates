-- Allows organizers to keep an external URL on an event without forcing
-- visitors away from the MentorMates event page.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS external_redirect_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.external_redirect_enabled IS
  'When true and external_url is set, non-manager event navigation redirects/links out to external_url. When false, MentorMates event pages remain accessible to all visitors.';
