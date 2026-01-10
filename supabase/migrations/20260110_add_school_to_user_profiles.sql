-- Add school/university field to user profiles
ALTER TABLE user_profiles ADD COLUMN school TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.school IS 'User school or university name';
