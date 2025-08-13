-- Inspect the role_passwords table structure and data
-- Run this first to understand the table structure

-- Step 1: Show table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'role_passwords' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Show sample data (first 5 rows)
SELECT * FROM role_passwords LIMIT 5;

-- Step 3: Show duplicate analysis with correct column names
SELECT 
    event_id,
    role,
    COUNT(*) as duplicate_count
FROM role_passwords
GROUP BY event_id, role
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 4: Show total counts
SELECT 
    COUNT(*) as total_rows,
    COUNT(DISTINCT event_id) as unique_events,
    COUNT(DISTINCT role) as unique_roles,
    COUNT(DISTINCT (event_id, role)) as unique_combinations
FROM role_passwords;
