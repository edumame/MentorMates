-- Ensure submission_field_type contains the full set of supported field types.
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'short_text';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'long_text';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'url';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'multi_url';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'file';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'select';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'multi_select';
ALTER TYPE public.submission_field_type ADD VALUE IF NOT EXISTS 'checkbox';
