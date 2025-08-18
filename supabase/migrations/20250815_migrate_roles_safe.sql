-- SAFE Migration: Convert string-based roles to numeric hierarchy system
-- This version handles existing constraints and potential edge cases

-- Step 1: Create backup tables for rollback safety
CREATE TABLE IF NOT EXISTS user_event_roles_backup AS 
SELECT * FROM user_event_roles;

CREATE TABLE IF NOT EXISTS role_passwords_backup AS 
SELECT * FROM role_passwords;

-- Step 2: Check current state and log it
DO $$
DECLARE
    user_roles_count INTEGER;
    role_passwords_count INTEGER;
    existing_constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_roles_count FROM user_event_roles;
    SELECT COUNT(*) INTO role_passwords_count FROM role_passwords;
    
    -- Check if constraint already exists
    SELECT COUNT(*) INTO existing_constraint_count
    FROM information_schema.table_constraints
    WHERE table_name = 'role_passwords' 
    AND constraint_name = 'role_passwords_event_id_role_key';
    
    RAISE NOTICE 'Starting migration with % user roles and % role passwords', user_roles_count, role_passwords_count;
    RAISE NOTICE 'Existing unique constraint exists: %', existing_constraint_count > 0;
END $$;

-- Step 3: Drop dependent RLS policies first
DROP POLICY IF EXISTS "Allow judges to create their own scores" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read all scores for their events" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read project_tracks for their events" ON project_tracks;
DROP POLICY IF EXISTS "Allow judges to read projects for their events" ON projects;
DROP POLICY IF EXISTS "Allow judges to update their own scores" ON project_scores;
DROP POLICY IF EXISTS "upload organizer 1201s55_0" ON storage.objects;
DROP POLICY IF EXISTS "upload organizer policy" ON storage.objects;
DROP POLICY IF EXISTS "Organizers can view event payments" ON user_event_payments;
DROP POLICY IF EXISTS "Organizers can manage assignments" ON project_assignments;

-- Step 4: Drop existing constraints that might conflict
ALTER TABLE role_passwords DROP CONSTRAINT IF EXISTS role_passwords_event_id_role_key;
ALTER TABLE user_event_roles DROP CONSTRAINT IF EXISTS check_valid_role;
ALTER TABLE role_passwords DROP CONSTRAINT IF EXISTS check_valid_role;

-- Step 5: Add temporary numeric columns
ALTER TABLE user_event_roles ADD COLUMN IF NOT EXISTS role_temp TEXT;
ALTER TABLE role_passwords ADD COLUMN IF NOT EXISTS role_temp TEXT;

-- Step 6: Convert existing roles to numeric strings (keeping as text for now)
UPDATE user_event_roles 
SET role_temp = CASE 
    WHEN role::text = 'participant' THEN '1'
    WHEN role::text = 'mentor' THEN '2'
    WHEN role::text = 'judge' THEN '3'
    WHEN role::text = 'organizer' THEN '4'
    WHEN role::text = 'admin' THEN '5'
    WHEN role::text = 'event' THEN '4'  -- Treat 'event' role as organizer level
    WHEN role::text = '1' THEN '1'      -- Already numeric
    WHEN role::text = '2' THEN '2'
    WHEN role::text = '3' THEN '3'
    WHEN role::text = '4' THEN '4'
    WHEN role::text = '5' THEN '5'
    ELSE '1'  -- Default to participant if unknown role
END;

UPDATE role_passwords 
SET role_temp = CASE 
    WHEN role::text = 'participant' THEN '1'
    WHEN role::text = 'mentor' THEN '2'
    WHEN role::text = 'judge' THEN '3'
    WHEN role::text = 'organizer' THEN '4'
    WHEN role::text = 'admin' THEN '5'
    WHEN role::text = 'event' THEN '4'  -- Treat 'event' role as organizer level
    WHEN role::text = '1' THEN '1'      -- Already numeric
    WHEN role::text = '2' THEN '2'
    WHEN role::text = '3' THEN '3'
    WHEN role::text = '4' THEN '4'
    WHEN role::text = '5' THEN '5'
    ELSE '1'  -- Default to participant if unknown role
END;

-- Step 7: Check for duplicates after conversion
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT event_id, role_temp, COUNT(*) as cnt
        FROM role_passwords
        GROUP BY event_id, role_temp
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Conversion created % duplicate combinations in role_passwords', duplicate_count;
    END IF;
END $$;

-- Step 8: Create new enum type if it doesn't exist
DO $$
BEGIN
    -- Drop existing enum if it exists
    DROP TYPE IF EXISTS event_role CASCADE;
    
    -- Create new numeric enum type
    CREATE TYPE event_role AS ENUM ('1', '2', '3', '4', '5');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'event_role type already exists, continuing...';
END $$;

-- Step 9: Drop old role columns and rename temp columns
ALTER TABLE user_event_roles DROP COLUMN role CASCADE;
ALTER TABLE role_passwords DROP COLUMN role CASCADE;

ALTER TABLE user_event_roles RENAME COLUMN role_temp TO role;
ALTER TABLE role_passwords RENAME COLUMN role_temp TO role;

-- Step 10: Convert text columns to enum type
ALTER TABLE user_event_roles ALTER COLUMN role TYPE event_role USING role::event_role;
ALTER TABLE role_passwords ALTER COLUMN role TYPE event_role USING role::event_role;

-- Step 11: Add NOT NULL constraints
ALTER TABLE user_event_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE role_passwords ALTER COLUMN role SET NOT NULL;

-- Step 12: Create unique constraint for role_passwords
ALTER TABLE role_passwords ADD CONSTRAINT role_passwords_event_id_role_key UNIQUE (event_id, role);

-- Step 13: Add role validation constraints
ALTER TABLE user_event_roles 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

ALTER TABLE role_passwords 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('1', '2', '3', '4', '5'));

-- Step 14: Recreate indexes
DROP INDEX IF EXISTS idx_user_event_roles_role;
DROP INDEX IF EXISTS idx_role_passwords_event_role;

CREATE INDEX idx_user_event_roles_role ON user_event_roles(role);
CREATE INDEX idx_role_passwords_event_role ON role_passwords(event_id, role);

-- Step 15: Create helper functions
CREATE OR REPLACE FUNCTION can_access_role(user_role text, target_role text)
RETURNS boolean AS $$
BEGIN
    RETURN user_role::integer >= target_role::integer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Step 16: Recreate RLS policies with numeric comparisons
CREATE POLICY "Allow judges to create their own scores" ON project_scores
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN projects p ON p.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND p.id = project_id
        AND can_access_role(uer.role::text, '3')
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
        AND can_access_role(uer.role::text, '3')
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
        AND can_access_role(uer.role::text, '3')
    )
);

CREATE POLICY "Allow judges to read project_tracks for their events" ON project_tracks
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN event_tracks et ON et.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND et.track_id = track_id
        AND can_access_role(uer.role::text, '3')
    )
);

CREATE POLICY "Allow judges to read projects for their events" ON projects
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        WHERE uer.user_id = auth.uid()
        AND uer.event_id = event_id
        AND can_access_role(uer.role::text, '3')
    )
);

CREATE POLICY "Organizers can view event payments" ON user_event_payments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        WHERE uer.user_id = auth.uid()
        AND uer.event_id = event_id
        AND can_access_role(uer.role::text, '4')
    )
);

-- Step 17: Handle project_assignments table if it exists
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
                AND can_access_role(uer.role::text, ''4'')
            )
        )';
    END IF;
END $$;

-- Step 18: Handle storage policies
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
                AND can_access_role(uer.role::text, ''4'')
            )
        )';
    END IF;
END $$;

-- Step 19: Add documentation
COMMENT ON TYPE event_role IS 'Numeric role hierarchy: 1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin';
COMMENT ON FUNCTION can_access_role(text, text) IS 'Check if user_role can access target_role functionality (higher numbers can access lower)';
COMMENT ON FUNCTION role_to_string(event_role) IS 'Convert numeric role enum to string representation';
COMMENT ON FUNCTION string_to_role(text) IS 'Convert string role to numeric enum (for backward compatibility)';

-- Step 20: Final verification
DO $$
DECLARE
    user_roles_count INTEGER;
    role_passwords_count INTEGER;
    numeric_roles_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_roles_count FROM user_event_roles;
    SELECT COUNT(*) INTO role_passwords_count FROM role_passwords;
    SELECT COUNT(*) INTO numeric_roles_count FROM user_event_roles WHERE role IN ('1', '2', '3', '4', '5');
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'User roles: %, Role passwords: %, Numeric roles: %', user_roles_count, role_passwords_count, numeric_roles_count;
    
    IF numeric_roles_count != user_roles_count THEN
        RAISE EXCEPTION 'Migration verification failed: Not all roles converted to numeric format';
    END IF;
END $$;

-- Migration completed successfully
-- Backup tables: user_event_roles_backup, role_passwords_backup
-- Helper functions: can_access_role, role_to_string, string_to_role
