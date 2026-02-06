-- Auto-create configured TODO conversations when a user is assigned a role in an event.

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
      AND a.event_id = p_event_id
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

CREATE OR REPLACE FUNCTION public.handle_user_event_role_auto_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_auto_conversations_for_event_role(NEW.user_id, NEW.event_id, NEW.role);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      PERFORM public.create_auto_conversations_for_event_role(NEW.user_id, NEW.event_id, NEW.role);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_event_roles_auto_conversations_trigger ON public.user_event_roles;

CREATE TRIGGER user_event_roles_auto_conversations_trigger
AFTER INSERT OR UPDATE OF role
ON public.user_event_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_event_role_auto_conversations();
