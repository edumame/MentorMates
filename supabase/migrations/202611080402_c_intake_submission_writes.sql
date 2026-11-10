-- Lane C (audit 2026-11-08): ORG-010
--
-- Participants could INSERT/UPDATE intake_form_submissions and their answers
-- directly through PostgREST, bypassing every server-side check (active form
-- version for the event/context, required fields, MLH consent checkboxes,
-- option lists). POST /api/events/[eventId]/intake-form/submissions now
-- validates and writes with the service role, so participants only need
-- read access to their own rows. Organizer/admin policies are unchanged.

drop policy if exists "Participants can create own intake submissions"
  on public.intake_form_submissions;
drop policy if exists "Participants can update own intake submissions"
  on public.intake_form_submissions;

drop policy if exists "Participants can insert answers for own submissions"
  on public.intake_form_submission_answers;
drop policy if exists "Participants can update answers for own draft submissions"
  on public.intake_form_submission_answers;
drop policy if exists "Participants can delete answers for own submissions"
  on public.intake_form_submission_answers;
