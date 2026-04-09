-- Add optional project_id column to agent_api_keys
ALTER TABLE agent_api_keys
  ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Index for project-scoped key lookups
CREATE INDEX idx_agent_api_keys_project ON agent_api_keys (project_id) WHERE project_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN agent_api_keys.project_id IS 'Optional: locks participant key to a specific project. NULL means key works across all user projects.';
