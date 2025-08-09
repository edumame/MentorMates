-- Migration: Convert string-based roles to numeric hierarchy system
-- This migration transforms the role system from string enums to numeric values
-- where higher numbers have more permissions (1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin)

-- Step 1: Create backup tables for rollback safety
CREATE TABLE IF NOT EXISTS user_event_roles_backup AS 
SELECT * FROM user_event_roles;

CREATE TABLE IF NOT EXISTS role_passwords_backup AS 
SELECT * FROM role_passwords;

-- Step 2: Add temporary numeric role column to user_event_roles
ALTER TABLE user_event_roles 
ADD COLUMN role_numeric INTEGER;

-- Step 3: Convert existing string roles to numeric values
UPDATE user_event_roles 
SET role_numeric = CASE 
    WHEN role = 'participant' THEN 1
    WHEN role = 'mentor' THEN 2
    WHEN role = 'judge' THEN 3
    WHEN role = 'organizer' THEN 4
    WHEN role = 'admin' THEN 5
    WHEN role = 'event' THEN 4  -- Treat 'event' role as organizer level
    ELSE 1  -- Default to participant if unknown role
END;

-- Step 4: Update role_passwords table to use numeric roles
ALTER TABLE role_passwords 
ADD COLUMN role_numeric INTEGER;

UPDATE role_passwords 
SET role_numeric = CASE 
    WHEN role = 'participant' THEN 1
    WHEN role = 'mentor' THEN 2
    WHEN role = 'judge' THEN 3
    WHEN role = 'organizer' THEN 4
    WHEN role = 'admin' THEN 5
    WHEN role = 'event' THEN 4  -- Treat 'event' role as organizer level
    ELSE 1  -- Default to participant if unknown role
END;

-- Step 5: Create new numeric role enum type
CREATE TYPE event_role_numeric AS ENUM ('1', '2', '3', '4', '5');

-- Step 6: Add new role column with numeric enum type
ALTER TABLE user_event_roles 
ADD COLUMN role_new event_role_numeric;

ALTER TABLE role_passwords 
ADD COLUMN role_new event_role_numeric;

-- Step 7: Populate new enum columns with converted values
UPDATE user_event_roles 
SET role_new = role_numeric::text::event_role_numeric;

UPDATE role_passwords 
SET role_new = role_numeric::text::event_role_numeric;

-- Step 8: Verify data integrity - ensure no nulls in new columns
DO $$ 
DECLARE 
    null_count INTEGER;
BEGIN 
    SELECT COUNT(*) INTO null_count 
    FROM user_event_roles 
    WHERE role_new IS NULL;
    
    IF null_count > 0 THEN 
        RAISE EXCEPTION 'Data migration failed: % rows with null role_new in user_event_roles', null_count;
    END IF;
    
    SELECT COUNT(*) INTO null_count 
    FROM role_passwords 
    WHERE role_new IS NULL;
    
    IF null_count > 0 THEN 
        RAISE EXCEPTION 'Data migration failed: % rows with null role_new in role_passwords', null_count;
    END IF;
END $$;

-- Step 9: Drop old constraints and indexes that reference the old role column
DROP INDEX IF EXISTS idx_user_event_roles_role;
DROP INDEX IF EXISTS idx_role_passwords_event_role;

-- Step 10: Drop old role columns
ALTER TABLE user_event_roles DROP COLUMN role;
ALTER TABLE user_event_roles DROP COLUMN role_numeric;
ALTER TABLE role_passwords DROP COLUMN role;
ALTER TABLE role_passwords DROP COLUMN role_numeric;

-- Step 11: Rename new role columns to replace old ones
ALTER TABLE user_event_roles RENAME COLUMN role_new TO role;
ALTER TABLE role_passwords RENAME COLUMN role_new TO role;

-- Step 12: Add NOT NULL constraints to new role columns
ALTER TABLE user_event_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE role_passwords ALTER COLUMN role SET NOT NULL;

-- Step 13: Update unique constraint for role_passwords
ALTER TABLE role_passwords DROP CONSTRAINT IF EXISTS role_passwords_event_id_role_key;
ALTER TABLE role_passwords ADD CONSTRAINT role_passwords_event_id_role_key UNIQUE (event_id, role);

-- Step 14: Recreate indexes for better performance
CREATE INDEX idx_user_event_roles_role ON user_event_roles(role);
CREATE INDEX idx_role_passwords_event_role ON role_passwords(event_id, role);

-- Step 15: Drop the old string enum type (this will cascade to any remaining references)
DROP TYPE IF EXISTS event_role CASCADE;

-- Step 16: Rename new numeric enum to the original name
ALTER TYPE event_role_numeric RENAME TO event_role;

-- Step 17: Add role hierarchy validation check constraint
ALTER TABLE user_event_roles 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

ALTER TABLE role_passwords 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

-- Step 18: Update RLS policies to work with numeric roles
-- Note: This assumes existing RLS policies exist and need to be updated
-- You may need to adjust these based on your specific policies

-- Create a function to help with role comparisons in RLS policies
CREATE OR REPLACE FUNCTION can_access_role(user_role text, target_role text)
RETURNS boolean AS $$
BEGIN
    RETURN user_role::integer >= target_role::integer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 19: Create role conversion helper functions for compatibility
CREATE OR REPLACE FUNCTION role_to_string(role_enum event_role)
RETURNS text AS $$
BEGIN
    RETURN CASE role_enum
        WHEN '1' THEN 'participant'
        WHEN '2' THEN 'mentor'  
        WHEN '3' THEN 'judge'
        WHEN '4' THEN 'organizer'
        WHEN '5' THEN 'admin'
        ELSE 'participant'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION string_to_role(role_string text)
RETURNS event_role AS $$
BEGIN
    RETURN CASE role_string
        WHEN 'participant' THEN '1'::event_role
        WHEN 'mentor' THEN '2'::event_role
        WHEN 'judge' THEN '3'::event_role
        WHEN 'organizer' THEN '4'::event_role
        WHEN 'admin' THEN '5'::event_role
        WHEN 'event' THEN '4'::event_role  -- Map event to organizer
        ELSE '1'::event_role  -- Default to participant
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 20: Add comments for documentation
COMMENT ON TYPE event_role IS 'Numeric role hierarchy: 1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin';
COMMENT ON FUNCTION can_access_role(text, text) IS 'Check if user_role can access target_role functionality (higher numbers can access lower)';
COMMENT ON FUNCTION role_to_string(event_role) IS 'Convert numeric role enum to string representation';
COMMENT ON FUNCTION string_to_role(text) IS 'Convert string role to numeric enum (for backward compatibility)';

-- Migration completed successfully
-- Backup tables: user_event_roles_backup, role_passwords_backup
-- Helper functions: can_access_role, role_to_string, string_to_role