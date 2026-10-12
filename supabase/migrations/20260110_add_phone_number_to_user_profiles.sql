-- Add phone number field to user profiles
-- Notes:
-- - Stored as plain text so users can include country codes (e.g. +1...)
-- - This value can be considered sensitive; UI should avoid showing it publicly.
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN user_profiles.phone_number IS 'User phone number (text; may include country code)';

