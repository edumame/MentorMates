CREATE TEMP TABLE project_assignments_to_delete AS
WITH ranked_assignments AS (
  SELECT
    id,
    project_id,
    user_id,
    role,
    created_at,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, user_id, role
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM project_assignments
)
SELECT
  id,
  project_id,
  user_id,
  role,
  created_at,
  updated_at
FROM ranked_assignments
WHERE duplicate_rank > 1;

DELETE FROM project_assignments
WHERE id IN (
  SELECT id
  FROM project_assignments_to_delete
);

CREATE UNIQUE INDEX IF NOT EXISTS project_assignments_project_user_role_unique_idx
  ON project_assignments (project_id, user_id, role);
