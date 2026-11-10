-- Only the token-verifying server may invoke this operation. Locking the project
-- avoids lost array updates when two valid invitations are accepted together.
CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_project_id uuid, p_user_id uuid, p_invited_by text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; caller_email text;
BEGIN
 SELECT lower(email) INTO caller_email FROM auth.users WHERE id = p_user_id;
 IF caller_email IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
 SELECT * INTO p FROM public.projects WHERE id = p_project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;
 IF NOT (coalesce(lower(p.lead_email) = lower(p_invited_by), false) OR EXISTS (
   SELECT 1 FROM unnest(coalesce(p.teammates, ARRAY[]::text[])) e WHERE lower(e) = lower(p_invited_by)
 )) THEN RAISE EXCEPTION 'Inviter is no longer a project member' USING ERRCODE = '42501'; END IF;
 IF p.event_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.user_event_roles WHERE event_id = p.event_id AND user_id = p_user_id
 ) THEN RAISE EXCEPTION 'Join the event before joining this project' USING ERRCODE = '42501'; END IF;
 IF coalesce(lower(p.lead_email), '') <> caller_email AND NOT EXISTS (
   SELECT 1 FROM unnest(coalesce(p.teammates, ARRAY[]::text[])) e WHERE lower(e) = caller_email
 ) THEN
   UPDATE public.projects SET teammates = array_append(coalesce(teammates, ARRAY[]::text[]), caller_email)
   WHERE id = p_project_id RETURNING * INTO p;
 END IF;
 RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.accept_project_invitation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(uuid, uuid, text) TO service_role;
