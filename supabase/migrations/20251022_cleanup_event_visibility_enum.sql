-- Clean up event_visibility enum by removing unused values
-- This migration removes 'test' and 'demo' visibility types as they're not used

-- Step 1: Update any existing events using 'test' or 'demo' to 'draft'
UPDATE public.events
SET visibility = 'draft'
WHERE visibility IN ('test', 'demo');

-- Step 2: Create a new enum with only the values we want
CREATE TYPE event_visibility_new AS ENUM ('draft', 'unlisted', 'private', 'public', 'archived');

-- Step 3: Alter the events table to use the new enum
ALTER TABLE public.events
  ALTER COLUMN visibility TYPE event_visibility_new
  USING visibility::text::event_visibility_new;

-- Step 4: Drop the old enum and rename the new one
DROP TYPE event_visibility;
ALTER TYPE event_visibility_new RENAME TO event_visibility;

-- Add comment to document the visibility types
COMMENT ON TYPE event_visibility IS
'Event visibility levels:
- draft: Only accessible to organizers and admins
- unlisted: Accessible via direct URL only (not in listings)
- private: Requires password to access (shown in listings for authenticated users)
- public: Fully public and discoverable in all listings
- archived: Read-only, accessible via direct URL only (like unlisted but with edit restrictions)';
