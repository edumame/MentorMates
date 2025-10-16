-- Create project_likes table to support likes on projects
CREATE TABLE IF NOT EXISTS public.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_likes_unique UNIQUE (project_id, user_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON public.project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_user_id ON public.project_likes(user_id);

-- Enable RLS
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow anyone (including unauthenticated) to read like rows for counts on public pages
DROP POLICY IF EXISTS project_likes_select_all ON public.project_likes;
CREATE POLICY project_likes_select_all ON public.project_likes
  FOR SELECT
  USING (true);

-- Only authenticated users can insert likes for themselves
DROP POLICY IF EXISTS project_likes_insert_own ON public.project_likes;
CREATE POLICY project_likes_insert_own ON public.project_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner of the like can delete it
DROP POLICY IF EXISTS project_likes_delete_own ON public.project_likes;
CREATE POLICY project_likes_delete_own ON public.project_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Disallow updates (no need to update like rows)
REVOKE UPDATE ON public.project_likes FROM PUBLIC;
