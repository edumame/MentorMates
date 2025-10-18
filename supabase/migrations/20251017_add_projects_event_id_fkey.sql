-- Add foreign key constraint to projects.event_id referencing events.event_id
-- This ensures referential integrity between projects and events

BEGIN;

-- First, clean up any orphaned projects by setting their event_id to NULL
-- These are projects that reference events that no longer exist
UPDATE "public"."projects"
SET "event_id" = NULL
WHERE "event_id" IS NOT NULL 
  AND "event_id" NOT IN (SELECT "event_id" FROM "public"."events");

-- Add the foreign key constraint
-- ON DELETE SET NULL: When an event is deleted, set event_id to NULL to preserve project data
-- This allows projects to exist independently even if their associated event is removed
ALTER TABLE "public"."projects"
ADD CONSTRAINT "projects_event_id_fkey" 
FOREIGN KEY ("event_id") 
REFERENCES "public"."events"("event_id") 
ON DELETE SET NULL;

-- Add a comment for documentation
COMMENT ON CONSTRAINT "projects_event_id_fkey" ON "public"."projects" 
IS 'Foreign key constraint ensuring projects belong to valid events. Sets event_id to NULL when event is removed.';

COMMIT;

