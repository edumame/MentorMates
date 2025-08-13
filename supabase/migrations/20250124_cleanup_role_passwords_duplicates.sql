-- Cleanup duplicates in role_passwords that arise when converting
-- 'event' -> '4' and 'organizer' -> '4' for the same event.

-- 1) Backup current table
CREATE TABLE IF NOT EXISTS role_passwords_cleanup_backup AS
SELECT * FROM role_passwords;

-- 2) Prefer keeping 'organizer' over 'event' for the same event
DELETE FROM role_passwords e
USING role_passwords o
WHERE e.event_id = o.event_id
  AND e.role::text = 'event'
  AND o.role::text = 'organizer';

-- 3) If any environment already has numeric roles mixed in,
--    prefer keeping numeric/organizer and drop the duplicate
DELETE FROM role_passwords e
USING role_passwords o
WHERE e.event_id = o.event_id
  AND e.role::text = '4'
  AND o.role::text IN ('organizer','event')
  AND e.ctid <> o.ctid; -- ensure we don't self-match

-- 4) As a safety net, remove exact duplicates keeping the newest (use primary key id)
WITH ranked AS (
  SELECT id, event_id, role, created_at,
         ROW_NUMBER() OVER (
           PARTITION BY event_id, role 
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM role_passwords
)
DELETE FROM role_passwords
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 5) Verify there are no duplicates after conversion mapping
WITH converted AS (
  SELECT event_id,
         CASE 
           WHEN role::text = 'participant' THEN '1'
           WHEN role::text = 'mentor' THEN '2'
           WHEN role::text = 'judge' THEN '3'
           WHEN role::text = 'organizer' THEN '4'
           WHEN role::text = 'admin' THEN '5'
           WHEN role::text = 'event' THEN '4'
           WHEN role::text IN ('1','2','3','4','5') THEN role::text
           ELSE '1'
         END AS converted_role
  FROM role_passwords
)
SELECT event_id, converted_role, COUNT(*) AS cnt
FROM converted
GROUP BY event_id, converted_role
HAVING COUNT(*) > 1;


