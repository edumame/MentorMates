-- Removes public read access to meetings, agents and agent_events.
--
-- These tables had USING (true) policies, so anyone with the public anon key could
-- read meeting summaries and recording URLs, and agent system instructions.
--
-- Server code that needs broader access uses the service client, which bypasses
-- these policies.

-- SECURITY DEFINER keeps these lookups from re-entering RLS. agents and
-- agent_events each need to check the other, which would otherwise recurse.
CREATE OR REPLACE FUNCTION public.has_event_role(p_event_id uuid, p_user_id uuid, p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND (p_roles IS NULL OR role::text = ANY (p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agent_owner(p_agent_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agents WHERE id = p_agent_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_agent_linked_to_user_event(p_agent_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_events ae
    JOIN public.user_event_roles uer ON uer.event_id = ae.event_id
    WHERE ae.agent_id = p_agent_id AND uer.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.has_event_role(uuid, uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_agent_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_agent_linked_to_user_event(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_event_role(uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agent_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agent_linked_to_user_event(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.meetings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agents;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agent_events;

-- Judges read agent scores, and teammates see their project's meeting timeline.
CREATE POLICY "Owners, teammates and event staff can read meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin_user((SELECT auth.uid()))
  OR public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR public.has_event_role(event_id, (SELECT auth.uid()), ARRAY['judge'])
  OR public.is_project_member(project_id, (SELECT auth.uid()))
);

-- Agents with no event are shared across the platform, so any signed-in user can
-- read them. Event members need their event's agents to start a conversation.
CREATE POLICY "Signed-in users can read agents they can use"
ON public.agents
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR event_id IS NULL
  OR public.is_admin_user((SELECT auth.uid()))
  OR public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR public.has_event_role(event_id, (SELECT auth.uid()))
  OR public.is_agent_linked_to_user_event(id, (SELECT auth.uid()))
);

CREATE POLICY "Agent owners and event members can read agent events"
ON public.agent_events
FOR SELECT
TO authenticated
USING (
  public.is_agent_owner(agent_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
  OR public.is_event_organizer_or_owner(event_id, (SELECT auth.uid()))
  OR public.has_event_role(event_id, (SELECT auth.uid()))
);
