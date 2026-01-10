-- Rename `user_profiles.school` to `affiliation`
-- Motivation: the field now represents a user's school/university OR company/organization.
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    -- Only rename if the old column exists and the new one doesn't.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'school'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'affiliation'
    ) THEN
      ALTER TABLE public.user_profiles RENAME COLUMN school TO affiliation;
    END IF;

    -- Ensure the column comment is correct (works whether the column was renamed or already existed).
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

