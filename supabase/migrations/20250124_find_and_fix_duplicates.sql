-- Find and fix the duplicate role combinations that are created during conversion

-- Step 1: Show the original roles before conversion
SELECT 
    event_id,
    role as original_role,
    COUNT(*) as count
FROM role_passwords
GROUP BY event_id, role
ORDER BY event_id, role;

-- Step 2: Show what the conversion would create (simulate the conversion)
WITH converted_roles AS (
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
        created_at,
        -- Add any other columns that exist in your table
        *
    FROM role_passwords
)
SELECT 
    cr.event_id,
    cr.converted_role,
    COUNT(*) as duplicate_count,
    string_agg(cr.original_role::text, ', ') as original_roles,
    array_agg(cr.created_at ORDER BY cr.created_at) as creation_dates
FROM converted_roles cr
GROUP BY cr.event_id, cr.converted_role
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 3: Show the specific problematic records in detail
WITH converted_roles AS (
    SELECT 
        *,
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
        END as converted_role
    FROM role_passwords
),
duplicates AS (
    SELECT event_id, converted_role
    FROM converted_roles
    GROUP BY event_id, converted_role
    HAVING COUNT(*) > 1
)
SELECT cr.*
FROM converted_roles cr
JOIN duplicates d ON cr.event_id = d.event_id AND cr.converted_role = d.converted_role
ORDER BY cr.event_id, cr.converted_role, cr.created_at;
