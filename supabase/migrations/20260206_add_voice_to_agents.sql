-- Add voice column to public.agents if it doesn't exist.
-- Stores either a built-in voice name (e.g. "alloy") or a custom voice id (e.g. "voice_...").
DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'voice'
    ) THEN
      ALTER TABLE public.agents
      ADD COLUMN voice text DEFAULT 'alloy';
    END IF;
  END IF;
END $$;
