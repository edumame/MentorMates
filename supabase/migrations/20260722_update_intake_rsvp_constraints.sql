-- Extend intake form submission constraints to cover the 'rsvp' context.
-- RSVP submissions, like registration, are per-user and never tied to a project.

-- The original CHECK was declared inline without a name, so Postgres
-- auto-named it intake_form_submissions_check.
ALTER TABLE public.intake_form_submissions
  DROP CONSTRAINT IF EXISTS intake_form_submissions_check;

ALTER TABLE public.intake_form_submissions
  ADD CONSTRAINT intake_form_submissions_context_project_check CHECK (
    (context = 'registration' AND project_id IS NULL)
    OR
    (context = 'project_submission' AND project_id IS NOT NULL)
    OR
    (context = 'rsvp' AND project_id IS NULL)
  );

-- One RSVP submission per user per event (mirrors the registration index).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_intake_form_submissions_rsvp
  ON public.intake_form_submissions(event_id, submitter_user_id)
  WHERE context = 'rsvp';
