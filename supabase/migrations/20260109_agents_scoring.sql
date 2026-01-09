-- Migration: add scoring column to public.agents
-- Created: 2026-01-09

-- Add `scoring` boolean column if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'scoring'
  ) THEN
    ALTER TABLE public.agents
      ADD COLUMN scoring boolean DEFAULT true;
  END IF;
END $$;
