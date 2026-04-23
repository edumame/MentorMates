-- Collaborative editing permissions for agents.
-- Allows event organizers/admins (plus event owners and platform admins) to manage
-- event-scoped agents while keeping global agents owner/admin controlled.

CREATE OR REPLACE FUNCTION public.can_manage_event_agents(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_owner_id uuid;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin_user(p_user_id) THEN
    RETURN true;
  END IF;

  SELECT e.owner_id
  INTO event_owner_id
  FROM public.events e
  WHERE e.event_id = p_event_id
  LIMIT 1;

  IF event_owner_id IS NOT NULL AND event_owner_id = p_user_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = p_event_id
      AND uer.user_id = p_user_id
      AND uer.role IN ('organizer', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_agent(p_agent_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_owner_id uuid;
  agent_event_id uuid;
BEGIN
  IF p_agent_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.user_id, a.event_id
  INTO agent_owner_id, agent_event_id
  FROM public.agents a
  WHERE a.id = p_agent_id
  LIMIT 1;

  IF agent_owner_id IS NULL THEN
    RETURN false;
  END IF;

  IF agent_owner_id = p_user_id THEN
    RETURN true;
  END IF;

  IF public.is_admin_user(p_user_id) THEN
    RETURN true;
  END IF;

  IF agent_event_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_manage_event_agents(agent_event_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_agent_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'agents.user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS prevent_agent_owner_change_trigger ON public.agents;
    CREATE TRIGGER prevent_agent_owner_change_trigger
    BEFORE UPDATE ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_agent_owner_change();
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL AND to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;

    CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.agents;
DROP POLICY IF EXISTS "Policy with table joins" ON public.agents;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.agents;
DROP POLICY IF EXISTS "Agents can insert when allowed for event" ON public.agents;
DROP POLICY IF EXISTS "Agents can be updated by owners and event editors" ON public.agents;
DROP POLICY IF EXISTS "Agents can be deleted by owners and event editors" ON public.agents;

CREATE POLICY "Agents can insert when allowed for event"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    event_id IS NULL
    OR public.can_manage_event_agents(event_id, (SELECT auth.uid()))
  )
);

CREATE POLICY "Agents can be updated by owners and event editors"
ON public.agents
FOR UPDATE
TO authenticated
USING (
  public.can_edit_agent(id, (SELECT auth.uid()))
)
WITH CHECK (
  public.can_edit_agent(id, (SELECT auth.uid()))
  AND (
    event_id IS NULL
    OR public.can_manage_event_agents(event_id, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Agents can be deleted by owners and event editors"
ON public.agents
FOR DELETE
TO authenticated
USING (
  public.can_edit_agent(id, (SELECT auth.uid()))
);

GRANT EXECUTE ON FUNCTION public.can_manage_event_agents(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_agent(uuid, uuid) TO authenticated, service_role;
