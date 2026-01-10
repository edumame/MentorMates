-- Update comment to reflect broader usage of the `school` field
-- We keep the column name as `school` for backwards compatibility with the API/UI.
COMMENT ON COLUMN user_profiles.school IS 'User school, university, or company';

