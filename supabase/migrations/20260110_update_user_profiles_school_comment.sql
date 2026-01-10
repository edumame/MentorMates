-- Update comment to reflect broader usage of this field.
-- NOTE: We renamed `school` -> `affiliation`, but some environments may run migrations
-- in different orders. This block is resilient and will not fail.
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'school'
    ) THEN
      COMMENT ON COLUMN public.user_profiles.school IS 'User school, university, company, or other affiliation';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'affiliation'
    ) THEN
      COMMENT ON COLUMN public.user_profiles.affiliation IS 'User school, university, company, or other affiliation';
    END IF;
  END IF;
END $$;

