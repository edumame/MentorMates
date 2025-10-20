-- Migration: Add avatar field to user_profiles table
-- Date: 2025-10-19
-- Description: Adds a nullable avatar field to store user profile pictures

-- Add avatar column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN avatar TEXT;

-- Add comment to document the column
COMMENT ON COLUMN user_profiles.avatar IS 'URL or path to user profile avatar image';

