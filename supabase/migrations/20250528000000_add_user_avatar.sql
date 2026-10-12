-- Add avatar_url, bio, and links columns to user_profiles table
-- avatar_url: Custom avatar that overrides the Google OAuth picture
-- bio: Short user biography/description
-- links: JSON object for social media handles

-- Add links column for social media handles (if it doesn't exist)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '{}'::jsonb;

-- Add avatar_url column for custom profile pictures
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add bio column for user descriptions
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comments explaining the columns
COMMENT ON COLUMN user_profiles.links IS 'JSON object containing social media links: linkedin, github, twitter, facebook, instagram, youtube, portfolio';
COMMENT ON COLUMN user_profiles.avatar_url IS 'Custom avatar URL for the user. If null, falls back to Google OAuth picture from auth metadata.';
COMMENT ON COLUMN user_profiles.bio IS 'Short biography or description for the user profile (max 500 characters).';

