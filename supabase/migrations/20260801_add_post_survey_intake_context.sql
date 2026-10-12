-- Add 'post_survey' to the intake form context enum so events can run a
-- post-event survey through the existing intake-form builder infrastructure.
-- Kept in its own migration: Postgres cannot use a new enum value in the
-- same transaction that adds it, so constraint changes live in the
-- follow-up migration (20260801_update_intake_post_survey_constraints.sql).

ALTER TYPE public.intake_form_context ADD VALUE IF NOT EXISTS 'post_survey';
