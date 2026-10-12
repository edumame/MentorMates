-- Support "Allow multiple entries" on file submission fields.
-- Mirrors the existing multi_url pattern: the flag is encoded in the field type,
-- with max_files bounding how many uploads a participant may attach.
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'multi_file';

ALTER TABLE public.event_submission_fields
  ADD COLUMN IF NOT EXISTS max_files INTEGER;

ALTER TABLE public.event_submission_fields
  DROP CONSTRAINT IF EXISTS event_submission_fields_max_files_range;

ALTER TABLE public.event_submission_fields
  ADD CONSTRAINT event_submission_fields_max_files_range
  CHECK (max_files IS NULL OR (max_files >= 2 AND max_files <= 20));
