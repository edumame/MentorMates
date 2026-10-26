-- Anonymized submissions: organizer toggle that hides participant identities
-- from non-organizer viewers (judges, mentors, participants) on the public
-- /api/projects responses. Organizers + global admins always see real names.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS submissions_anonymized boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.submissions_anonymized IS
  'When true, project submissions on this event are anonymized to non-organizer viewers (judges, mentors, participants). Organizers + global admins always see real identities.';
