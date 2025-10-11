-- Add created_by_user_id to events table, nullable for backward compatibility
-- Also add FK to user_profiles(uid) and an index for queries
-- Down migration reverses these changes

BEGIN;

-- 1) Add column as nullable to avoid breaking existing rows
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL;

-- 2) Add FK constraint to user_profiles(uid)
ALTER TABLE public.events
  ADD CONSTRAINT events_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES public.user_profiles(uid)
  ON DELETE SET NULL;

-- 3) Create an index to speed up lookups by creator
CREATE INDEX IF NOT EXISTS idx_events_created_by_user_id
  ON public.events (created_by_user_id);

COMMIT;

-- Down migration
-- Note: Wrap in transaction separately to avoid issues in some migration runners
BEGIN;

-- Drop index if exists
DROP INDEX IF EXISTS public.idx_events_created_by_user_id;

-- Drop constraint if exists
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_created_by_user_id_fkey;

-- Drop column if exists
ALTER TABLE public.events
  DROP COLUMN IF EXISTS created_by_user_id;

COMMIT;
