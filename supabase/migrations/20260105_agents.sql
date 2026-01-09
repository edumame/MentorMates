-- ===============================
-- public.agents
-- ===============================
DO $$
BEGIN
  IF to_regclass('public.agents') IS NULL THEN
    CREATE TABLE public.agents (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      name text,
      user_id uuid DEFAULT auth.uid(),
      instructions text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      avatar_url text DEFAULT 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?q=80&w=1331&auto=format&fit=facearea&facepad=4&w=256&h=256'::text,
      event_id uuid,
      enabled boolean DEFAULT true,
      type text NOT NULL DEFAULT 'brainstorm',
      CONSTRAINT agents_pkey PRIMARY KEY (id)
    );
  END IF;
END $$;

-- Enable RLS (idempotent)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agents'
      AND policyname='Enable delete for users based on user_id'
  ) THEN
    CREATE POLICY "Enable delete for users based on user_id"
    ON public.agents
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING (((SELECT auth.uid() AS uid) = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agents'
      AND policyname='Enable insert for authenticated users only'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users only"
    ON public.agents
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((auth.uid() = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agents'
      AND policyname='Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users"
    ON public.agents
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename  = 'agents'
        AND policyname = 'Policy with table joins'
    ) THEN
    CREATE POLICY "Policy with table joins"
    ON public.agents
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));
    ELSE
    -- Harden existing policy to prevent changing ownership
    ALTER POLICY "Policy with table joins"
    ON public.agents
    WITH CHECK ((auth.uid() = user_id));
    END IF;
END $$;
