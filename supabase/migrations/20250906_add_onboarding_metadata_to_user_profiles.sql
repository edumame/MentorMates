-- Add onboarding_metadata column to user_profiles for onboarding flow
-- Stores a JSONB object with answers and completion state

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_metadata JSONB;

COMMENT ON COLUMN public.user_profiles.onboarding_metadata IS 'Onboarding responses and flags for user';

-- Optional GIN index for querying by keys/values if needed later
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_metadata_gin
  ON public.user_profiles USING gin (onboarding_metadata);

