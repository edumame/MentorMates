-- Fix participant resubmission of intake forms (registration / RSVP).
--
-- The submit flow replaces an existing submission's answers on the user's
-- authed client: UPDATE submission -> DELETE answers -> INSERT answers.
-- Participants only had UPDATE on 'draft' submissions and no DELETE on
-- answers, so both statements silently affected 0 rows and the re-insert
-- then failed on UNIQUE(submission_id, field_key).

DROP POLICY IF EXISTS "Participants can update own draft intake submissions"
  ON public.intake_form_submissions;

CREATE POLICY "Participants can update own intake submissions"
ON public.intake_form_submissions
FOR UPDATE
TO authenticated
USING (submitter_user_id = (SELECT auth.uid()))
WITH CHECK (submitter_user_id = (SELECT auth.uid()));

CREATE POLICY "Participants can delete answers for own submissions"
ON public.intake_form_submission_answers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = (SELECT auth.uid())
  )
);
