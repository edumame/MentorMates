-- Migration: Copy avatar_url from auth.users user_metadata to user_profiles
-- Date: 2025-12-06
-- Description: Copies the avatar_url from Supabase auth user metadata to the avatar_url column in user_profiles.
--              This is a one-time data migration for existing users.

-- Update user_profiles with avatar_url from auth.users raw_user_meta_data
-- Only updates rows where avatar_url is currently NULL to avoid overwriting custom avatars
UPDATE public.user_profiles up
SET avatar_url = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE up.uid = au.id
  AND up.avatar_url IS NULL
  AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL;

-- Also check for 'picture' key (used by some OAuth providers like Google)
UPDATE public.user_profiles up
SET avatar_url = au.raw_user_meta_data->>'picture'
FROM auth.users au
WHERE up.uid = au.id
  AND up.avatar_url IS NULL
  AND au.raw_user_meta_data->>'picture' IS NOT NULL;

