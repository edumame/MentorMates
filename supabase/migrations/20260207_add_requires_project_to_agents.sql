-- Add requires_project column to public.agents if it doesn't exist.
-- This column determines whether a meeting with this agent requires a project to be selected.
DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'requires_project'
    ) THEN
      ALTER TABLE public.agents
      ADD COLUMN requires_project boolean DEFAULT true;
    END IF;
  END IF;
END $$;
