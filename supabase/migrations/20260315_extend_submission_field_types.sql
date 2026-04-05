-- Extend submission_field_type enum with additional field types
-- needed for the dynamic submission editor ported from event-scraper.
ALTER TYPE submission_field_type ADD VALUE IF NOT EXISTS 'file';
ALTER TYPE submission_field_type ADD VALUE IF NOT EXISTS 'select';
ALTER TYPE submission_field_type ADD VALUE IF NOT EXISTS 'multi_select';
ALTER TYPE submission_field_type ADD VALUE IF NOT EXISTS 'checkbox';
