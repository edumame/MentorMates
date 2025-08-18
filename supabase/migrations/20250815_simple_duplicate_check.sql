-- Simple diagnostic to find the duplicate issue

-- Step 1: Show current role_passwords table structure and data
SELECT 'Current role_passwords data:' as info;
SELECT * FROM role_passwords ORDER BY event_id, role;

-- Step 2: Show what happens when we convert roles to numeric
SELECT 'Conversion simulation - this shows what would happen:' as info;

SELECT 
    event_id,
    role as original_role,
    CASE 
        WHEN role::text = 'participant' THEN '1'
        WHEN role::text = 'mentor' THEN '2'
        WHEN role::text = 'judge' THEN '3'
        WHEN role::text = 'organizer' THEN '4'
        WHEN role::text = 'admin' THEN '5'
        WHEN role::text = 'event' THEN '4'  -- This might cause duplicates!
        WHEN role::text = '1' THEN '1'
        WHEN role::text = '2' THEN '2'
        WHEN role::text = '3' THEN '3'
        WHEN role::text = '4' THEN '4'
        WHEN role::text = '5' THEN '5'
        ELSE '1'
    END as converted_role,
    created_at
FROM role_passwords
ORDER BY event_id, converted_role;

-- Step 3: Find duplicates that would be created
SELECT 'These combinations would create duplicates:' as info;

SELECT 
    event_id,
    CASE 
        WHEN role::text = 'participant' THEN '1'
        WHEN role::text = 'mentor' THEN '2'
        WHEN role::text = 'judge' THEN '3'
        WHEN role::text = 'organizer' THEN '4'
        WHEN role::text = 'admin' THEN '5'
        WHEN role::text = 'event' THEN '4'
        WHEN role::text = '1' THEN '1'
        WHEN role::text = '2' THEN '2'
        WHEN role::text = '3' THEN '3'
        WHEN role::text = '4' THEN '4'
        WHEN role::text = '5' THEN '5'
        ELSE '1'
    END as converted_role,
    COUNT(*) as duplicate_count,
    string_agg(role::text, ' + ') as conflicting_original_roles
FROM role_passwords
GROUP BY 
    event_id,
    CASE 
        WHEN role::text = 'participant' THEN '1'
        WHEN role::text = 'mentor' THEN '2'
        WHEN role::text = 'judge' THEN '3'
        WHEN role::text = 'organizer' THEN '4'
        WHEN role::text = 'admin' THEN '5'
        WHEN role::text = 'event' THEN '4'
        WHEN role::text = '1' THEN '1'
        WHEN role::text = '2' THEN '2'
        WHEN role::text = '3' THEN '3'
        WHEN role::text = '4' THEN '4'
        WHEN role::text = '5' THEN '5'
        ELSE '1'
    END
HAVING COUNT(*) > 1
ORDER BY event_id;
