-- Add external Contextus project id to link MentorMates projects with Contextus
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS contextus_project_id text;

-- Optional: create an index to speed up lookups by external id
CREATE INDEX IF NOT EXISTS idx_projects_contextus_project_id
  ON public.projects (contextus_project_id);