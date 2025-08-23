-- Add submitted flags to projects for draft/final state
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS submitted boolean;

-- Set all existing projects to submitted = true
UPDATE public.projects
  SET submitted = true
  WHERE submitted IS NULL;

-- Now set the default to false for new projects
ALTER TABLE public.projects
  ALTER COLUMN submitted SET DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Helpful index for gallery queries
CREATE INDEX IF NOT EXISTS idx_projects_event_submitted ON public.projects (event_id, submitted);