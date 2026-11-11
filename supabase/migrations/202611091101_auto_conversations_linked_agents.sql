-- Auto conversations must also cover agents linked to an event through
-- agent_events. Linking never changes agents.event_id, and agents.create never
-- writes a junction row, so an agent belongs to an event if either one says so.
-- Forward-only: this does not backfill users who already joined an event.

-- Without agent_events the new function would raise inside the user_event_roles
-- trigger and block event joins, so stop before replacing the working version.
DO $$
BEGIN
  IF to_regclass('public.agent_events') IS NULL THEN
    RAISE EXCEPTION 'public.agent_events is missing; apply 20260211_agent_events.sql first';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_auto_conversations_for_event_role(
  p_user_id uuid,
  p_event_id uuid,
  p_role public.event_role
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_caps_cfg jsonb;
  role_agent_ids jsonb;
  agent_text text;
  agent_uuid uuid;
  agent_name text;
  inserted_count integer := 0;
BEGIN
  SELECT e.session_caps
  INTO session_caps_cfg
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF session_caps_cfg IS NULL THEN
    RETURN 0;
  END IF;

  role_agent_ids := session_caps_cfg -> 'auto_conversations' -> (p_role::text);

  IF role_agent_ids IS NULL OR jsonb_typeof(role_agent_ids) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR agent_text IN
    SELECT value
    FROM jsonb_array_elements_text(role_agent_ids) AS t(value)
  LOOP
    BEGIN
      agent_uuid := agent_text::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        CONTINUE;
    END;

    SELECT a.name
    INTO agent_name
    FROM public.agents a
    WHERE a.id = agent_uuid
      AND (
        a.event_id = p_event_id
        OR EXISTS (
          SELECT 1
          FROM public.agent_events ae
          WHERE ae.agent_id = a.id
            AND ae.event_id = p_event_id
        )
      )
      AND COALESCE(a.enabled, true)
    LIMIT 1;

    IF agent_name IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.user_id = p_user_id
        AND m.event_id = p_event_id
        AND m.agent_id = agent_uuid
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.meetings (
      name,
      user_id,
      agent_id,
      event_id,
      status,
      created_at,
      updated_at
    )
    VALUES (
      'TODO: ' || agent_name,
      p_user_id,
      agent_uuid,
      p_event_id,
      'upcoming',
      NOW(),
      NOW()
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;
