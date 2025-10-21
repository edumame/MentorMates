-- Add foreign key constraint to feedback.project_id referencing projects.id
-- This ensures referential integrity between feedback and projects
-- First, check for orphaned feedback records before deletion
-- This will display feedback that references non-existent projects
SELECT
    *
FROM
    "public"."feedback"
WHERE
    "project_id" IS NOT NULL
    AND "project_id" NOT IN (
        SELECT
            "id"
        FROM
            "public"."projects"
    );

BEGIN;

-- Clean up any orphaned feedback by deleting records
-- These are feedback records that reference projects that no longer exist
DELETE FROM "public"."feedback"
WHERE
    "project_id" IS NOT NULL
    AND "project_id" NOT IN (
        SELECT
            "id"
        FROM
            "public"."projects"
    );

-- Add the foreign key constraint
-- ON DELETE CASCADE: When a project is deleted, delete associated feedback
-- This makes sense because feedback without a project has no context
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects" ("id") ON DELETE CASCADE;

-- Add a comment for documentation
COMMENT ON CONSTRAINT "feedback_project_id_fkey" ON "public"."feedback" IS 'Foreign key constraint ensuring feedback belongs to valid projects. Cascades delete when project is removed.';

COMMIT;