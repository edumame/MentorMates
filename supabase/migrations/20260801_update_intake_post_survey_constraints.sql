-- Extend intake form submission constraints to cover the 'post_survey' context.
-- Post-survey submissions, like registration and RSVP, are per-user and never
-- tied to a project.

ALTER TABLE public.intake_form_submissions
  DROP CONSTRAINT IF EXISTS intake_form_submissions_context_project_check;

ALTER TABLE public.intake_form_submissions
  ADD CONSTRAINT intake_form_submissions_context_project_check CHECK (
    (context = 'registration' AND project_id IS NULL)
    OR
    (context = 'project_submission' AND project_id IS NOT NULL)
    OR
    (context = 'rsvp' AND project_id IS NULL)
    OR
    (context = 'post_survey' AND project_id IS NULL)
  );

-- One post-survey submission per user per event (mirrors the RSVP index).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_intake_form_submissions_post_survey
  ON public.intake_form_submissions(event_id, submitter_user_id)
  WHERE context = 'post_survey';
