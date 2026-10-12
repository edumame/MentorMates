-- Add 'rsvp' to the intake form context enum so events can run a custom
-- RSVP form through the existing intake-form builder infrastructure.
-- Kept in its own migration: Postgres cannot use a new enum value in the
-- same transaction that adds it, so constraint changes live in the
-- follow-up migration (20260722_update_intake_rsvp_constraints.sql).

ALTER TYPE public.intake_form_context ADD VALUE IF NOT EXISTS 'rsvp';
