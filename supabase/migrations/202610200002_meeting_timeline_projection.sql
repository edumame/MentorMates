-- Stage 1: additive projection. Deploy its application consumer before stage 2.
BEGIN;
CREATE OR REPLACE FUNCTION public.meeting_full_access(p_owner uuid, p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_owner IS NOT DISTINCT FROM auth.uid() OR (
      p_event IS NOT NULL AND (
        public.is_admin_user(auth.uid()) OR EXISTS (
          SELECT 1 FROM public.events e WHERE e.event_id = p_event AND e.owner_id = auth.uid()
        ) OR EXISTS (
          SELECT 1 FROM public.user_event_roles r WHERE r.event_id = p_event
          AND r.user_id = auth.uid() AND r.role IN ('organizer', 'admin')
        )
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.meeting_full_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_full_access(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_meeting_timeline(p_project_id uuid)
RETURNS TABLE(id uuid, name text, status public.meeting_status, started_at timestamptz,
  ended_at timestamptz, created_at timestamptz, score integer, can_view_details boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Reuse existing project SELECT semantics, not the narrower edit predicate.
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = p_project_id
      AND (p.private = false OR public.can_view_project(p.id, auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Project unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.id,m.name,m.status,m.started_at,m.ended_at,m.created_at,m.score,
    coalesce(public.meeting_full_access(m.user_id,m.event_id),false)
  FROM public.meetings m JOIN public.projects p ON p.id = m.project_id
  WHERE m.project_id = p_project_id AND m.event_id IS NOT DISTINCT FROM p.event_id
  ORDER BY m.started_at DESC NULLS FIRST, m.created_at DESC, m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.project_meeting_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_meeting_timeline(uuid) TO authenticated, service_role;
-- SECURITY DEFINER helper queries associations without widening callers' table access.
-- Caller identity always comes from verified auth claims, never an argument.
CREATE OR REPLACE FUNCTION public.meeting_associations_allowed(p_agent uuid,p_event uuid,p_project uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); a public.agents%ROWTYPE; p public.projects%ROWTYPE;
BEGIN
 IF uid IS NULL OR p_agent IS NULL THEN RETURN false; END IF;
 SELECT * INTO a FROM public.agents WHERE id=p_agent;
 IF NOT FOUND OR a.enabled = false THEN RETURN false; END IF;
 IF p_event IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.events WHERE event_id=p_event) THEN RETURN false; END IF;
   IF NOT (public.meeting_full_access(NULL,p_event) OR EXISTS(
     SELECT 1 FROM public.user_event_roles WHERE event_id=p_event AND user_id=uid
   )) THEN RETURN false; END IF;
   -- Global agents remain usable; event agents require primary or junction match.
   IF a.event_id IS NOT NULL AND a.event_id IS DISTINCT FROM p_event AND NOT EXISTS(
     SELECT 1 FROM public.agent_events WHERE agent_id=p_agent AND event_id=p_event
   ) THEN RETURN false; END IF;
 ELSE
   -- Standalone use of another event's agent is not authorized by public visibility.
   IF a.event_id IS NOT NULL AND a.user_id IS DISTINCT FROM uid THEN RETURN false; END IF;
 END IF;
 IF p_project IS NOT NULL THEN
   SELECT * INTO p FROM public.projects WHERE id=p_project;
   IF NOT FOUND OR p.event_id IS DISTINCT FROM p_event THEN RETURN false; END IF;
   IF NOT public.is_project_member(p_project,uid) THEN RETURN false; END IF;
 END IF;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.meeting_associations_allowed(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.meeting_associations_allowed(uuid,uuid,uuid) TO authenticated,service_role;


COMMIT;
