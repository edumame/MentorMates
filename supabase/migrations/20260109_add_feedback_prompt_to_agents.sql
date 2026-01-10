-- Add feedback_prompt column to public.agents if it doesn't exist
DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'feedback_prompt'
    ) THEN
      ALTER TABLE public.agents
      ADD COLUMN feedback_prompt text;
    END IF;
  END IF;
END $$;
