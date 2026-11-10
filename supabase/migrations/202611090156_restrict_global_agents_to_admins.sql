-- An agent with event_id NULL is global: every user can see and pick it.
-- Only platform admins may create one, or turn an event agent into one, and
-- deleting an event never turns its agents into global ones.
--
-- Global agents that already exist are left in place. Their owners can still
-- edit, disable and delete them, which is why the UPDATE rule is a trigger on
-- the event_id transition and not a policy on the new row.

CREATE OR REPLACE FUNCTION public.prevent_agent_global_promotion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- auth.uid() is NULL for service-role and SQL-editor sessions. A trigger depth
  -- above 1 is the agents.event_id foreign key acting on an event delete. That
  -- action must not publish an agent: release_event_agents has already cleared
  -- the event, so a row here arrived mid-delete and the delete fails instead.
  IF pg_trigger_depth() > 1
    OR (auth.uid() IS NOT NULL AND NOT public.is_admin_user(auth.uid())) THEN
    RAISE EXCEPTION 'Only platform admins can make an agent global'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- agents.event_id is ON DELETE SET NULL, and NULL means global, so anyone who can
-- delete an event would otherwise publish its agents. Any user can create an event.
-- Admin-owned agents are included because event organizers can edit them.
--
-- An agent still linked to another event moves there. The rest are deleted, and
-- their meetings go with them through the meetings.agent_id cascade. SECURITY
-- DEFINER because the caller may not own every agent on the event.
CREATE OR REPLACE FUNCTION public.release_event_agents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agents a
  SET event_id = linked.event_id
  FROM (
    SELECT DISTINCT ON (ae.agent_id) ae.agent_id, ae.event_id
    FROM public.agent_events ae
    JOIN public.events e ON e.event_id = ae.event_id
    WHERE ae.event_id <> OLD.event_id
    ORDER BY ae.agent_id, ae.created_at, ae.event_id
  ) linked
  WHERE a.id = linked.agent_id
    AND a.event_id = OLD.event_id;

  DELETE FROM public.agents WHERE event_id = OLD.event_id;

  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.agents') IS NULL
    OR to_regclass('public.agent_events') IS NULL
    OR to_regclass('public.events') IS NULL
    OR to_regprocedure('public.is_admin_user(uuid)') IS NULL
    OR to_regprocedure('public.can_manage_event_agents(uuid, uuid)') IS NULL THEN
    RAISE WARNING 'Skipping global agent restriction: public.agents or its permission functions are missing';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS prevent_agent_global_promotion_trigger ON public.agents;
  CREATE TRIGGER prevent_agent_global_promotion_trigger
  BEFORE UPDATE OF event_id ON public.agents
  FOR EACH ROW
  WHEN (OLD.event_id IS NOT NULL AND NEW.event_id IS NULL)
  EXECUTE FUNCTION public.prevent_agent_global_promotion();

  DROP TRIGGER IF EXISTS release_event_agents_trigger ON public.events;
  CREATE TRIGGER release_event_agents_trigger
  BEFORE DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.release_event_agents();

  -- Policies are permissive, so the original policy must go too if it is still present.
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.agents;
  DROP POLICY IF EXISTS "Agents can insert when allowed for event" ON public.agents;

  CREATE POLICY "Agents can insert when allowed for event"
  ON public.agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      (event_id IS NULL AND public.is_admin_user((SELECT auth.uid())))
      OR (event_id IS NOT NULL AND public.can_manage_event_agents(event_id, (SELECT auth.uid())))
    )
  );
END;
$$;
