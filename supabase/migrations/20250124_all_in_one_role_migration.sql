-- ALL-IN-ONE ROLE MIGRATION SCRIPT
-- Purpose: Convert string-based roles to numeric hierarchy, clean duplicates,
--          rebuild constraints and RLS policies, and verify success.
-- Safe to run once in production. Idempotent where possible.

-- 0) Context info
DO $$ BEGIN RAISE NOTICE 'Starting all-in-one role migration at %', now(); END $$;

-- 1) Backups (idempotent)
CREATE TABLE IF NOT EXISTS user_event_roles_backup AS SELECT * FROM user_event_roles;
CREATE TABLE IF NOT EXISTS role_passwords_backup   AS SELECT * FROM role_passwords;

-- 2) Pre-clean duplicates in role_passwords that would arise from conversion
--    Prefer keeping organizer over event for the same event_id
DELETE FROM role_passwords e
USING role_passwords o
WHERE e.event_id = o.event_id
  AND e.role::text = 'event'
  AND o.role::text = 'organizer';

--    Also handle mixed numeric/string duplicates conservatively
DELETE FROM role_passwords e
USING role_passwords o
WHERE e.event_id = o.event_id
  AND e.role::text = '4'
  AND o.role::text IN ('organizer','event')
  AND e.id <> o.id;

--    Remove exact duplicates keeping newest
WITH ranked AS (
  SELECT id, event_id, role, created_at,
         ROW_NUMBER() OVER (
           PARTITION BY event_id, role ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM role_passwords
)
DELETE FROM role_passwords
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Drop dependent policies and constraints (best-effort)
DROP POLICY IF EXISTS "Allow judges to create their own scores" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read all scores for their events" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to update their own scores" ON project_scores;
DROP POLICY IF EXISTS "Allow judges to read project_tracks for their events" ON project_tracks;
DROP POLICY IF EXISTS "Allow judges to read projects for their events" ON projects;
DROP POLICY IF EXISTS "Organizers can view event payments" ON user_event_payments;
DROP POLICY IF EXISTS "Organizers can manage assignments" ON project_assignments;
DROP POLICY IF EXISTS "upload organizer 1201s55_0" ON storage.objects;
DROP POLICY IF EXISTS "upload organizer policy" ON storage.objects;

ALTER TABLE role_passwords   DROP CONSTRAINT IF EXISTS role_passwords_event_id_role_key;
ALTER TABLE user_event_roles DROP CONSTRAINT IF EXISTS check_valid_role;
ALTER TABLE role_passwords   DROP CONSTRAINT IF EXISTS check_valid_role;
DROP INDEX IF EXISTS idx_user_event_roles_role;
DROP INDEX IF EXISTS idx_role_passwords_event_role;

-- 4) Normalize to temporary TEXT columns (idempotent adds)
ALTER TABLE user_event_roles ADD COLUMN IF NOT EXISTS role_temp TEXT;
ALTER TABLE role_passwords   ADD COLUMN IF NOT EXISTS role_temp TEXT;

--    Map existing roles (strings or already-numeric) to '1'..'5' in role_temp
UPDATE user_event_roles 
SET role_temp = CASE 
  WHEN role::text = 'participant' THEN '1'
  WHEN role::text = 'mentor'      THEN '2'
  WHEN role::text = 'judge'       THEN '3'
  WHEN role::text = 'organizer'   THEN '4'
  WHEN role::text = 'admin'       THEN '5'
  WHEN role::text = 'event'       THEN '4'
  WHEN role::text IN ('1','2','3','4','5') THEN role::text
  ELSE '1'
END
WHERE role_temp IS NULL OR role_temp <> CASE 
  WHEN role::text = 'participant' THEN '1'
  WHEN role::text = 'mentor'      THEN '2'
  WHEN role::text = 'judge'       THEN '3'
  WHEN role::text = 'organizer'   THEN '4'
  WHEN role::text = 'admin'       THEN '5'
  WHEN role::text = 'event'       THEN '4'
  WHEN role::text IN ('1','2','3','4','5') THEN role::text
  ELSE '1'
END;

UPDATE role_passwords 
SET role_temp = CASE 
  WHEN role::text = 'participant' THEN '1'
  WHEN role::text = 'mentor'      THEN '2'
  WHEN role::text = 'judge'       THEN '3'
  WHEN role::text = 'organizer'   THEN '4'
  WHEN role::text = 'admin'       THEN '5'
  WHEN role::text = 'event'       THEN '4'
  WHEN role::text IN ('1','2','3','4','5') THEN role::text
  ELSE '1'
END
WHERE role_temp IS NULL OR role_temp <> CASE 
  WHEN role::text = 'participant' THEN '1'
  WHEN role::text = 'mentor'      THEN '2'
  WHEN role::text = 'judge'       THEN '3'
  WHEN role::text = 'organizer'   THEN '4'
  WHEN role::text = 'admin'       THEN '5'
  WHEN role::text = 'event'       THEN '4'
  WHEN role::text IN ('1','2','3','4','5') THEN role::text
  ELSE '1'
END;

--    Auto-resolve duplicates that conversion would create (keep newest)
WITH conv AS (
  SELECT id, event_id,
         CASE role_temp WHEN 'event' THEN '4' ELSE role_temp END AS conv_role,
         created_at
  FROM role_passwords
), ranked AS (
  SELECT id, event_id, conv_role,
         ROW_NUMBER() OVER (PARTITION BY event_id, conv_role ORDER BY created_at DESC NULLS LAST, id DESC) rn
  FROM conv
)
DELETE FROM role_passwords rp
USING ranked r
WHERE rp.id = r.id AND r.rn > 1;

-- 5) Recreate enum as numeric type and flip columns
DO $$
BEGIN
  -- Drop old enum if present (no tables should reference it now)
  DROP TYPE IF EXISTS event_role CASCADE;
  -- Create numeric enum
  CREATE TYPE event_role AS ENUM ('1','2','3','4','5');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'event_role type already exists';
END $$;

-- Swap columns to enum
ALTER TABLE user_event_roles DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE role_passwords   DROP COLUMN IF EXISTS role CASCADE;

ALTER TABLE user_event_roles RENAME COLUMN role_temp TO role;
ALTER TABLE role_passwords   RENAME COLUMN role_temp TO role;

ALTER TABLE user_event_roles ALTER COLUMN role TYPE event_role USING role::event_role;
ALTER TABLE role_passwords   ALTER COLUMN role TYPE event_role USING role::event_role;

ALTER TABLE user_event_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE role_passwords   ALTER COLUMN role SET NOT NULL;

-- 6) Constraints and indexes
ALTER TABLE role_passwords ADD CONSTRAINT role_passwords_event_id_role_key UNIQUE (event_id, role);
ALTER TABLE user_event_roles ADD CONSTRAINT check_valid_role CHECK (role IN ('1','2','3','4','5'));
ALTER TABLE role_passwords   ADD CONSTRAINT check_valid_role CHECK (role IN ('1','2','3','4','5'));

CREATE INDEX IF NOT EXISTS idx_user_event_roles_role   ON user_event_roles(role);
CREATE INDEX IF NOT EXISTS idx_role_passwords_event_role ON role_passwords(event_id, role);

-- 7) Helper functions
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
  RETURN CASE lower(role_string)
    WHEN 'participant' THEN '1'::event_role
    WHEN 'mentor'      THEN '2'::event_role
    WHEN 'judge'       THEN '3'::event_role
    WHEN 'organizer'   THEN '4'::event_role
    WHEN 'admin'       THEN '5'::event_role
    WHEN 'event'       THEN '4'::event_role
    WHEN '1'           THEN '1'::event_role
    WHEN '2'           THEN '2'::event_role
    WHEN '3'           THEN '3'::event_role
    WHEN '4'           THEN '4'::event_role
    WHEN '5'           THEN '5'::event_role
    ELSE '1'::event_role
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8) Recreate policies with numeric comparisons
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
  user_id = auth.uid() AND EXISTS (
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_assignments') THEN
    EXECUTE $$
      CREATE POLICY "Organizers can manage assignments" ON project_assignments
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_event_roles uer
          JOIN projects p ON p.id = project_id
          WHERE uer.user_id = auth.uid()
            AND uer.event_id = p.event_id
            AND can_access_role(uer.role::text, '4')
        )
      )
    $$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'uploads') THEN
    EXECUTE $$
      CREATE POLICY "upload organizer policy" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'uploads' AND EXISTS (
          SELECT 1 FROM user_event_roles uer
          WHERE uer.user_id = auth.uid()
            AND can_access_role(uer.role::text, '4')
        )
      )
    $$;
  END IF;
END $$;

-- 9) Verification
DO $$
DECLARE ur_count int; np_count int; bad_count int; dup_count int;
BEGIN
  SELECT COUNT(*) INTO ur_count FROM user_event_roles;
  SELECT COUNT(*) INTO np_count FROM role_passwords;
  SELECT COUNT(*) INTO bad_count FROM user_event_roles WHERE role NOT IN ('1','2','3','4','5');
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT event_id, role, COUNT(*) c FROM role_passwords GROUP BY 1,2 HAVING COUNT(*) > 1
  ) d;
  RAISE NOTICE 'Verification -> user_event_roles: %, role_passwords: %, invalid_roles: %, duplicates_in_role_passwords: %', ur_count, np_count, bad_count, dup_count;
  IF bad_count > 0 OR dup_count > 0 THEN
    RAISE EXCEPTION 'Post-migration verification failed.';
  END IF;
END $$;

-- 10) Docs
COMMENT ON TYPE event_role IS 'Numeric role hierarchy: 1=participant, 2=mentor, 3=judge, 4=organizer, 5=admin';
COMMENT ON FUNCTION can_access_role(text, text) IS 'Check if user_role can access target_role (>= comparison).';
COMMENT ON FUNCTION role_to_string(event_role) IS 'Convert numeric role enum to string';
COMMENT ON FUNCTION string_to_role(text) IS 'Convert string/numeric text to numeric event_role enum';

DO $$ BEGIN RAISE NOTICE 'Role migration completed successfully at %', now(); END $$;


