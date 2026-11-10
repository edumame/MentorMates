-- Direct inserts bypassed role, event relation and aggregate count checks.
DROP POLICY IF EXISTS "Users can insert their own votes" ON public.project_votes;
REVOKE INSERT, UPDATE ON public.project_votes FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.cast_project_vote(p_event_id uuid, p_project_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); votes integer;
BEGIN
 IF actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.user_event_roles WHERE event_id = p_event_id AND user_id = actor AND role::text <> 'judge'
 ) THEN RAISE EXCEPTION 'Not eligible to vote' USING ERRCODE = '42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND event_id = p_event_id)
 THEN RAISE EXCEPTION 'Project does not belong to event' USING ERRCODE = '22023'; END IF;
 -- Per-user/event serialization, including simultaneous votes for distinct projects.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || actor::text, 0));
 SELECT count(*) INTO votes FROM public.project_votes WHERE event_id = p_event_id AND user_id = actor;
 IF EXISTS (SELECT 1 FROM public.project_votes WHERE project_id = p_project_id AND user_id = actor)
 THEN RETURN greatest(0, 3-votes); END IF;
 IF votes >= 3 THEN RAISE EXCEPTION 'You can only vote for 3 projects per event' USING ERRCODE = '23514'; END IF;
 INSERT INTO public.project_votes(project_id,user_id,event_id) VALUES(p_project_id,actor,p_event_id);
 RETURN 3-votes-1;
END $$;
REVOKE ALL ON FUNCTION public.cast_project_vote(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_project_vote(uuid,uuid) TO authenticated;

-- JSON aggregates are one row: PostgREST max_rows cannot truncate vote totals.
CREATE OR REPLACE FUNCTION public.project_vote_summary(p_event_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT jsonb_build_object(
 'voteCounts', coalesce((SELECT jsonb_object_agg(project_id, n) FROM
   (SELECT project_id, count(*) n FROM public.project_votes WHERE event_id=p_event_id GROUP BY project_id) counts), '{}'::jsonb),
 'userVotes', coalesce((SELECT jsonb_agg(project_id) FROM public.project_votes WHERE event_id=p_event_id AND user_id=auth.uid()), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.project_vote_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_vote_summary(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_vote_results(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_event_organizer_or_owner(p_event_id,auth.uid())
 THEN RAISE EXCEPTION 'Only organizers can view voting results' USING ERRCODE = '42501'; END IF;
 RETURN jsonb_build_object('eventId',p_event_id,
 'totalVotes',(SELECT count(*) FROM public.project_votes WHERE event_id=p_event_id),
 'totalVoters',(SELECT count(DISTINCT user_id) FROM public.project_votes WHERE event_id=p_event_id),
 'results',coalesce((SELECT jsonb_agg(row_data ORDER BY n DESC) FROM (
 SELECT count(*) n, jsonb_build_object('projectId',p.id,'projectName',coalesce(p.project_name,'Untitled Project'),
 'leadName',coalesce(p.lead_name,'Unknown'),'coverImageUrl',p.cover_image_url,'voteCount',count(*),'voters',jsonb_agg(v.user_id)) row_data
 FROM public.project_votes v JOIN public.projects p ON p.id=v.project_id WHERE v.event_id=p_event_id
 GROUP BY p.id) grouped),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.project_vote_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_vote_results(uuid) TO authenticated;
