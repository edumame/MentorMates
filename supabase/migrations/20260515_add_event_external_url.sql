-- External-link events: an event can point at an outside site.
-- By default, when external_url is set, the event card links out (new tab)
-- and /events/<slug> redirects to this URL instead of rendering the
-- MentorMates event page. NULL = normal MentorMates-hosted event.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS external_url TEXT;

COMMENT ON COLUMN events.external_url IS
  'Optional outside event URL. When redirects are enabled, event cards and /events/<slug> send non-manager visitors here. NULL = normal hosted event.';
