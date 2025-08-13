-- Migration: Convert string-based roles to numeric hierarchy system (FIXED VERSION)
-- This migration transforms the role system from string enums to numeric values
-- where higher numbers have more permissions (1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin)

-- Step 1: Create backup tables for rollback safety
CREATE TABLE IF NOT EXISTS user_event_roles_backup AS 
SELECT * FROM user_event_roles;

CREATE TABLE IF NOT EXISTS role_passwords_backup AS 
SELECT * FROM role_passwords;

-- Step 2: Drop dependent RLS policies first (they will be recreated later)
DROP POLICY IF EXISTS "Allow judges to create their own scores" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read all scores for their events" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read project_tracks for their events" ON project_tracks;
DROP POLICY IF EXISTS "Allow judges to read projects for their events" ON projects;
DROP POLICY IF EXISTS "Allow judges to update their own scores" ON project_scores;
DROP POLICY IF EXISTS "upload organizer 1201s55_0" ON storage.objects;
DROP POLICY IF EXISTS "Organizers can view event payments" ON user_event_payments;
DROP POLICY IF EXISTS "Organizers can manage assignments" ON project_assignments;

-- Step 3: Add temporary numeric role column to user_event_roles
ALTER TABLE user_event_roles 
ADD COLUMN role_numeric INTEGER;

-- Step 4: Convert existing string roles to numeric values
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

-- Step 5: Update role_passwords table to use numeric roles
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

-- Step 6: Create new numeric role enum type
CREATE TYPE event_role_numeric AS ENUM ('1', '2', '3', '4', '5');

-- Step 7: Add new role column with numeric enum type
ALTER TABLE user_event_roles 
ADD COLUMN role_new event_role_numeric;

ALTER TABLE role_passwords 
ADD COLUMN role_new event_role_numeric;

-- Step 8: Populate new enum columns with converted values
UPDATE user_event_roles 
SET role_new = role_numeric::text::event_role_numeric;

UPDATE role_passwords 
SET role_new = role_numeric::text::event_role_numeric;

-- Step 9: Verify data integrity - ensure no nulls in new columns
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

-- Step 10: Drop old constraints and indexes that reference the old role column
DROP INDEX IF EXISTS idx_user_event_roles_role;
DROP INDEX IF EXISTS idx_role_passwords_event_role;

-- Step 11: Drop old role columns
ALTER TABLE user_event_roles DROP COLUMN role CASCADE;
ALTER TABLE user_event_roles DROP COLUMN role_numeric;
ALTER TABLE role_passwords DROP COLUMN role CASCADE;
ALTER TABLE role_passwords DROP COLUMN role_numeric;

-- Step 12: Rename new role columns to replace old ones
ALTER TABLE user_event_roles RENAME COLUMN role_new TO role;
ALTER TABLE role_passwords RENAME COLUMN role_new TO role;

-- Step 13: Add NOT NULL constraints to new role columns
ALTER TABLE user_event_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE role_passwords ALTER COLUMN role SET NOT NULL;

-- Step 14: Update unique constraint for role_passwords
ALTER TABLE role_passwords DROP CONSTRAINT IF EXISTS role_passwords_event_id_role_key;
ALTER TABLE role_passwords ADD CONSTRAINT role_passwords_event_id_role_key UNIQUE (event_id, role);

-- Step 15: Recreate indexes for better performance
CREATE INDEX idx_user_event_roles_role ON user_event_roles(role);
CREATE INDEX idx_role_passwords_event_role ON role_passwords(event_id, role);

-- Step 16: Drop the old string enum type (this will cascade to any remaining references)
DROP TYPE IF EXISTS event_role CASCADE;

-- Step 17: Rename new numeric enum to the original name
ALTER TYPE event_role_numeric RENAME TO event_role;

-- Step 18: Add role hierarchy validation check constraint
ALTER TABLE user_event_roles 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

ALTER TABLE role_passwords 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

-- Step 19: Create a function to help with role comparisons in RLS policies
CREATE OR REPLACE FUNCTION can_access_role(user_role text, target_role text)
RETURNS boolean AS $$
BEGIN
    RETURN user_role::integer >= target_role::integer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 20: Create role conversion helper functions for compatibility
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

-- Step 21: Recreate RLS policies with numeric role comparisons
-- Note: These are recreated with the new numeric role system

-- Project scores policies
CREATE POLICY "Allow judges to create their own scores" ON project_scores
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN projects p ON p.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND p.id = project_id
        AND can_access_role(uer.role::text, '3')  -- Judge level or higher
    )
);

CREATE POLICY "Allow judges to read all scores for their events" ON project_scores
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN projects p ON p.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND p.id = project_id
        AND can_access_role(uer.role::text, '3')  -- Judge level or higher
    )
);

CREATE POLICY "Allow judges to update their own scores" ON project_scores
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN projects p ON p.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND p.id = project_id
        AND can_access_role(uer.role::text, '3')  -- Judge level or higher
    )
);

-- Project tracks policies
CREATE POLICY "Allow judges to read project_tracks for their events" ON project_tracks
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN event_tracks et ON et.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND et.track_id = track_id
        AND can_access_role(uer.role::text, '3')  -- Judge level or higher
    )
);

-- Projects policies
CREATE POLICY "Allow judges to read projects for their events" ON projects
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        WHERE uer.user_id = auth.uid()
        AND uer.event_id = event_id
        AND can_access_role(uer.role::text, '3')  -- Judge level or higher
    )
);

-- User event payments policies
CREATE POLICY "Organizers can view event payments" ON user_event_payments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        WHERE uer.user_id = auth.uid()
        AND uer.event_id = event_id
        AND can_access_role(uer.role::text, '4')  -- Organizer level or higher
    )
);

-- Project assignments policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_assignments') THEN
        EXECUTE 'CREATE POLICY "Organizers can manage assignments" ON project_assignments
        FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_event_roles uer
                JOIN projects p ON p.id = project_id
                WHERE uer.user_id = auth.uid()
                AND uer.event_id = p.event_id
                AND can_access_role(uer.role::text, ''4'')  -- Organizer level or higher
            )
        )';
    END IF;
END $$;

-- Storage policies (recreate with numeric roles)
-- Note: You may need to adjust the bucket name and specific policy logic
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'uploads') THEN
        EXECUTE 'CREATE POLICY "upload organizer policy" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = ''uploads'' AND
            EXISTS (
                SELECT 1 FROM user_event_roles uer
                WHERE uer.user_id = auth.uid()
                AND can_access_role(uer.role::text, ''4'')  -- Organizer level or higher
            )
        )';
    END IF;
END $$;

-- Step 22: Add comments for documentation
COMMENT ON TYPE event_role IS 'Numeric role hierarchy: 1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin';
COMMENT ON FUNCTION can_access_role(text, text) IS 'Check if user_role can access target_role functionality (higher numbers can access lower)';
COMMENT ON FUNCTION role_to_string(event_role) IS 'Convert numeric role enum to string representation';
COMMENT ON FUNCTION string_to_role(text) IS 'Convert string role to numeric enum (for backward compatibility)';

-- Migration completed successfully
-- Backup tables: user_event_roles_backup, role_passwords_backup
-- Helper functions: can_access_role, role_to_string, string_to_role
