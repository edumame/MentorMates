-- ===============================
-- public.meetings
-- ===============================
DO $$
BEGIN
  IF to_regclass('public.meetings') IS NULL THEN
    CREATE TABLE public.meetings (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      name text,
      user_id uuid DEFAULT auth.uid(),
      agent_id text,
      status meeting_status DEFAULT 'upcoming'::meeting_status,
      started_at timestamp with time zone,
      ended_at timestamp with time zone,
      transcript_url text,
      recording_url text,
      summary text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      score integer,
      project_id uuid,
      event_id uuid,
      CONSTRAINT meetings_pkey PRIMARY KEY (id)
    );
  END IF;
END $$;

-- Enable RLS (idempotent)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='meetings'
      AND policyname='Enable delete for users based on user_id'
  ) THEN
    CREATE POLICY "Enable delete for users based on user_id"
    ON public.meetings
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING (((SELECT auth.uid() AS uid) = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='meetings'
      AND policyname='Enable insert for users based on user_id'
  ) THEN
    CREATE POLICY "Enable insert for users based on user_id"
    ON public.meetings
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((auth.uid() = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='meetings'
      AND policyname='Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users"
    ON public.meetings
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'meetings'
      AND policyname = 'Users can update own meetings'
  ) THEN
    CREATE POLICY "Users can update own meetings"
    ON public.meetings
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));
  ELSE
    -- Harden existing policy to prevent changing ownership
    ALTER POLICY "Users can update own meetings"
    ON public.meetings
    WITH CHECK ((auth.uid() = user_id));
  END IF;
END $$;
