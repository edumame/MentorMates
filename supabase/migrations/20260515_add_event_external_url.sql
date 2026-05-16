-- External-link events: an event can point at an outside site.
-- When external_url is set, the event card links out (new tab) and the
-- /events/<slug> route redirects to this URL instead of rendering the
-- MentorMates event page. NULL = normal MentorMates-hosted event.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS external_url TEXT;

COMMENT ON COLUMN events.external_url IS
  'When set, the event is a link-out: card opens this URL in a new tab and /events/<slug> redirects here. NULL = normal hosted event.';
