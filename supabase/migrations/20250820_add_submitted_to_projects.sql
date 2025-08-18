-- Add submitted flags to projects for draft/final state
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS submitted boolean DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Helpful index for gallery queries
CREATE INDEX IF NOT EXISTS idx_projects_event_submitted ON public.projects (event_id, submitted);

