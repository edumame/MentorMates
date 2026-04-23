-- ===============================
-- public.agent_events (junction table)
-- Links agents to multiple events without duplicating agent records.
-- ===============================
DO $$
BEGIN
  IF to_regclass('public.agent_events') IS NULL THEN
    CREATE TABLE public.agent_events (
      agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
      event_id uuid NOT NULL,
      agent_name text,
      event_name text,
      created_at timestamp with time zone DEFAULT now(),
      CONSTRAINT agent_events_pkey PRIMARY KEY (agent_id, event_id)
    );
  END IF;
END $$;

-- Add name columns if they don't already exist (handles re-runs on existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_events' AND column_name = 'agent_name'
  ) THEN
    ALTER TABLE public.agent_events ADD COLUMN agent_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_events' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE public.agent_events ADD COLUMN event_name text;
  END IF;
END $$;

-- Seed from existing agents.event_id so current assignments are preserved
INSERT INTO public.agent_events (agent_id, event_id, agent_name, event_name)
SELECT a.id, a.event_id, a.name, e.event_name
FROM public.agents a
LEFT JOIN public.events e ON e.event_id = a.event_id
WHERE a.event_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Enable RLS (idempotent)
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agent_events'
      AND policyname='Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users"
    ON public.agent_events
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agent_events'
      AND policyname='Enable insert for agent owner'
  ) THEN
    CREATE POLICY "Enable insert for agent owner"
    ON public.agent_events
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.agents
        WHERE agents.id = agent_id AND agents.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agent_events'
      AND policyname='Enable delete for agent owner'
  ) THEN
    CREATE POLICY "Enable delete for agent owner"
    ON public.agent_events
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.agents
        WHERE agents.id = agent_id AND agents.user_id = auth.uid()
      )
    );
  END IF;
END $$;
