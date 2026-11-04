-- Removes the interim read policy from 202611030002_restrict_meeting_agent_reads.sql
-- once the stricter meetings_read_authorized policy exists.
--
-- Permissive policies OR together, so leaving the interim policy in place would
-- keep full-row teammate reads. 202610200003_restrict_meetings.sql drops it too,
-- but that file sorts first, so this one covers a database migrated in filename
-- order. Without the stricter policy this does nothing, so reads can't be lost.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meetings'
      AND policyname = 'meetings_read_authorized'
  ) THEN
    DROP POLICY IF EXISTS "Owners, teammates and event staff can read meetings" ON public.meetings;
  END IF;
END $$;
