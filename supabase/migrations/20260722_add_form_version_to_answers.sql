-- Stamp each intake answer with the form version it was written against.
-- intake_form_submissions.form_version_id is mutable (resubmission updates it),
-- so answers carry their own form_version_id for durable data fidelity and to
-- make version mismatches detectable after a partial answer-replace failure.

ALTER TABLE public.intake_form_submission_answers
  ADD COLUMN form_version_id UUID REFERENCES public.intake_form_versions(id) ON DELETE RESTRICT;

-- Backfill existing answers from their parent submission.
UPDATE public.intake_form_submission_answers a
SET form_version_id = s.form_version_id
FROM public.intake_form_submissions s
WHERE a.submission_id = s.id
  AND a.form_version_id IS NULL;

ALTER TABLE public.intake_form_submission_answers
  ALTER COLUMN form_version_id SET NOT NULL;

CREATE INDEX idx_intake_form_submission_answers_form_version
  ON public.intake_form_submission_answers(form_version_id);
