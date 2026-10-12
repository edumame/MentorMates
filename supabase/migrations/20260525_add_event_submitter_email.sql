-- Add submitter_email to events table for anonymous public submissions
-- See issue #769

ALTER TABLE events ADD COLUMN submitter_email TEXT;

COMMENT ON COLUMN events.submitter_email IS 'Email of the person who submitted this event via the public submission form. Used for anonymous submissions (where owner_id is NULL) and for approval/rejection notifications.';

CREATE INDEX idx_events_submitter_email ON events(submitter_email) WHERE submitter_email IS NOT NULL;
