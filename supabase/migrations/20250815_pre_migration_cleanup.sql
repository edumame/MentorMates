-- Pre-migration cleanup: Remove duplicate entries in role_passwords table
-- This script must be run BEFORE the main role migration

-- Step 1: Identify and log duplicate entries
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT event_id, role, COUNT(*) as cnt
        FROM role_passwords
        GROUP BY event_id, role
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % duplicate role_password combinations', duplicate_count;
END $$;

-- Step 2: Show the duplicate entries for review
SELECT 
    event_id,
    role,
    COUNT(*) as duplicate_count,
    array_agg(password) as passwords,
    array_agg(created_at ORDER BY created_at) as created_dates
FROM role_passwords
GROUP BY event_id, role
HAVING COUNT(*) > 1
ORDER BY event_id, role;

-- Step 3: Create a backup of the role_passwords table before cleanup
CREATE TABLE IF NOT EXISTS role_passwords_pre_cleanup_backup AS 
SELECT * FROM role_passwords;

-- Step 4: Remove duplicates, keeping the most recent entry for each (event_id, role) combination
WITH ranked_passwords AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY event_id, role 
            ORDER BY created_at DESC, password
        ) as rn
    FROM role_passwords
)
DELETE FROM role_passwords
WHERE (event_id, role, password, created_at) IN (
    SELECT event_id, role, password, created_at
    FROM ranked_passwords
    WHERE rn > 1
);

-- Step 5: Verify cleanup was successful
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT event_id, role, COUNT(*) as cnt
        FROM role_passwords
        GROUP BY event_id, role
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF remaining_duplicates > 0 THEN
        RAISE EXCEPTION 'Cleanup failed: % duplicate combinations still exist', remaining_duplicates;
    ELSE
        RAISE NOTICE 'Cleanup successful: No duplicate combinations remain';
    END IF;
END $$;

-- Step 6: Show final state
SELECT 
    COUNT(*) as total_role_passwords,
    COUNT(DISTINCT (event_id, role)) as unique_combinations
FROM role_passwords;

-- Cleanup completed - now you can run the main migration
