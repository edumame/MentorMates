-- Narrows meeting access on top of 202611030002 and 202611060401.
--
-- 1. Full meeting rows (transcript/recording URLs, summary, scores) are readable
--    only by the meeting owner and the staff who manage its event (event owner,
--    event organizer/admin role, platform admin for event meetings). Teammates
--    and judges, who 202611030002 let read full rows, now get the fixed-column
--    project_meeting_timeline() instead.
-- 2. Clients can write only meeting metadata (name, owner on insert, agent,
--    event, project). Status, timestamps, summary and scores are server-set.
--    protect_meeting_provider_urls (202611060401) still guards the provider
--    URLs and provisioning_failed; this does not replace it.
-- 3. A client-chosen agent/event/project must belong together and to the caller.
-- 4. The auto-conversation SECURITY DEFINER function is no longer callable by
--    clients; the user_event_roles trigger keeps creating TODO conversations.
--
-- Safe to apply before the matching app deploy: the previous app only writes
-- the metadata columns granted here, and readers that lose rows get fewer rows,
-- not errors.

-- Full-row access. Matches the app's meetings.getOne / requireMeetingAccess.
CREATE OR REPLACE FUNCTION public.meeting_full_access(p_owner uuid, p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_owner IS NOT DISTINCT FROM auth.uid()
    OR (
      p_event IS NOT NULL AND (
        coalesce(public.is_admin_user(auth.uid()), false)
        OR public.is_event_organizer_or_owner(p_event, auth.uid())
        OR public.has_event_role(p_event, auth.uid(), ARRAY['admin'])
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.meeting_full_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_full_access(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Owners, teammates and event staff can read meetings" ON public.meetings;
DROP POLICY IF EXISTS "Owners and event staff can read meetings" ON public.meetings;
CREATE POLICY "Owners and event staff can read meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (public.meeting_full_access(user_id, event_id));

-- Metadata-only timeline for a project. Row visibility is what 202611030002
-- allowed (owner, event staff, judges of the meeting's event, project members);
-- only the columns are narrowed. Meetings whose event differs from the
-- project's event are left out so a mismatched row can't show on a project.
CREATE OR REPLACE FUNCTION public.project_meeting_timeline(p_project_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  status public.meeting_status,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz,
  score integer,
  can_view_details boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  is_member boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  is_member := public.is_project_member(p_project_id, uid);

  RETURN QUERY
  SELECT m.id, m.name, m.status, m.started_at, m.ended_at, m.created_at, m.score,
         public.meeting_full_access(m.user_id, m.event_id)
  FROM public.meetings m
  JOIN public.projects p ON p.id = m.project_id
  WHERE m.project_id = p_project_id
    AND m.event_id IS NOT DISTINCT FROM p.event_id
    AND (
      is_member
      OR public.meeting_full_access(m.user_id, m.event_id)
      OR (m.event_id IS NOT NULL AND public.has_event_role(m.event_id, uid, ARRAY['judge']))
    )
  ORDER BY m.started_at DESC NULLS FIRST, m.created_at DESC, m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.project_meeting_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_meeting_timeline(uuid) TO authenticated, service_role;

-- Whether the caller may link this agent/event/project to their own meeting.
-- Identity comes from auth.uid(), never an argument.
CREATE OR REPLACE FUNCTION public.meeting_associations_allowed(p_agent uuid, p_event uuid, p_project uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  agent_event uuid;
  agent_owner uuid;
  agent_enabled boolean;
  project_event uuid;
BEGIN
  IF uid IS NULL OR p_agent IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.event_id, a.user_id, a.enabled
    INTO agent_event, agent_owner, agent_enabled
  FROM public.agents a
  WHERE a.id = p_agent;
  IF NOT FOUND OR agent_enabled = false THEN
    RETURN false;
  END IF;

  IF p_event IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = p_event) THEN
      RETURN false;
    END IF;
    -- The caller must belong to or manage the event.
    IF NOT (public.has_event_role(p_event, uid) OR public.meeting_full_access(NULL, p_event)) THEN
      RETURN false;
    END IF;
    -- Platform agents work anywhere; event agents need their event or a link.
    IF agent_event IS NOT NULL AND agent_event IS DISTINCT FROM p_event AND NOT EXISTS (
      SELECT 1 FROM public.agent_events ae WHERE ae.agent_id = p_agent AND ae.event_id = p_event
    ) THEN
      RETURN false;
    END IF;
  ELSIF agent_event IS NOT NULL AND agent_owner IS DISTINCT FROM uid THEN
    -- Another event's agent can't be used outside its event.
    RETURN false;
  END IF;

  IF p_project IS NOT NULL THEN
    SELECT p.event_id INTO project_event FROM public.projects p WHERE p.id = p_project;
    IF NOT FOUND OR project_event IS DISTINCT FROM p_event THEN
      RETURN false;
    END IF;
    IF NOT public.is_project_member(p_project, uid) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_associations_allowed(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_associations_allowed(uuid, uuid, uuid) TO authenticated, service_role;

-- Client write limits. Column ACLs outlive a table-level REVOKE, so clear them
-- per column too.
REVOKE ALL ON public.meetings FROM PUBLIC, anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.meetings'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format(
    'REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.meetings FROM PUBLIC, anon, authenticated',
    cols
  );
END $$;
GRANT SELECT, DELETE ON public.meetings TO authenticated;
GRANT INSERT (name, user_id, agent_id, event_id, project_id) ON public.meetings TO authenticated;
GRANT UPDATE (name, agent_id, event_id, project_id) ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

-- Same trusted-role test as protect_meeting_provider_urls. Rows written by
-- SECURITY DEFINER functions (auto conversations) run as their owner and skip it.
CREATE OR REPLACE FUNCTION public.validate_meeting_client_associations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.agent_id IS NOT DISTINCT FROM OLD.agent_id
     AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
     AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    -- Renames keep working on meetings whose agent was later disabled.
    RETURN NEW;
  END IF;
  IF NOT public.meeting_associations_allowed(NEW.agent_id, NEW.event_id, NEW.project_id) THEN
    RAISE EXCEPTION 'Invalid meeting association' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_meeting_client_associations() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_meeting_client_associations ON public.meetings;
CREATE TRIGGER validate_meeting_client_associations
BEFORE INSERT OR UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_client_associations();

-- Callable directly, this SECURITY DEFINER function inserts meetings for any
-- user id. Only the user_event_roles trigger (which runs as its owner) and the
-- server need it.
DO $$
BEGIN
  IF to_regprocedure('public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_auto_conversations_for_event_role(uuid, uuid, public.event_role) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.create_auto_conversations_for_event_role(uuid, uuid, public.event_role) TO service_role;
  END IF;
  IF to_regprocedure('public.handle_user_event_role_auto_conversations()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.handle_user_event_role_auto_conversations() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
