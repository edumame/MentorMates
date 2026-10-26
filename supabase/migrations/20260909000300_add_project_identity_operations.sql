-- M1c: narrow, transactional operations for the compatible application.
-- No existing project is converted and no backfill is started by this file.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

CREATE FUNCTION project_identity_private.assert_account(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
      AND u.deleted_at IS NULL AND u.confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
  ) THEN
    RAISE EXCEPTION 'A verified, active account is required' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

CREATE FUNCTION project_identity_private.assert_eligible(p_project_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  PERFORM project_identity_private.assert_account(p_user_id);
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id
    AND (p.event_id IS NULL OR public.user_has_event_role(p.event_id, p_user_id))) THEN
    RAISE EXCEPTION 'Join the event before joining its project' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

-- The only compatibility writer. Never writes the shadow table itself; the
-- project trigger handles that, including removals and reconciliation.
CREATE FUNCTION project_identity_private.write_legacy_member(
  p_project_id uuid, p_action text, p_user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_email text; v_old_lead text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Legacy identity cannot be resolved' USING ERRCODE = '55000'; END IF;
  IF p_action = 'add' THEN
    UPDATE public.projects SET teammates = ARRAY(
      SELECT DISTINCT e FROM unnest(COALESCE(teammates, '{}'::text[]) || ARRAY[v_email]) t(e)
      ORDER BY e
    ) WHERE id = p_project_id;
  ELSIF p_action = 'remove' THEN
    UPDATE public.projects SET teammates = ARRAY(
      SELECT e FROM unnest(COALESCE(teammates, '{}'::text[])) t(e)
      WHERE lower(btrim(e)) IS DISTINCT FROM lower(btrim(v_email))
    ) WHERE id = p_project_id;
  ELSIF p_action = 'transfer' THEN
    SELECT lead_email INTO v_old_lead FROM public.projects WHERE id = p_project_id;
    UPDATE public.projects SET lead_email = v_email, lead_name = 'Team member', teammates = ARRAY(
      SELECT DISTINCT e FROM unnest(COALESCE(teammates, '{}'::text[]) || ARRAY[v_old_lead]) t(e)
      WHERE e IS NOT NULL AND btrim(e) <> '' AND lower(btrim(e)) <> lower(btrim(v_email))
      ORDER BY e
    ) WHERE id = p_project_id;
  ELSE
    RAISE EXCEPTION 'Unknown membership operation' USING ERRCODE = '22023';
  END IF;
END;
$fn$;

CREATE FUNCTION project_identity_private.change_member(
  p_project_id uuid, p_action text, p_user_id uuid, p_actor uuid,
  p_invitation_acceptance boolean DEFAULT false
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text; v_target_role text; v_actor_lead boolean; v_revision bigint;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('add', 'remove', 'transfer') OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid membership operation' USING ERRCODE = '22023';
  END IF;
  PERFORM project_identity_private.lock_project(p_project_id);
  PERFORM project_identity_private.assert_account(p_actor);
  SELECT source INTO v_source FROM project_identity_private.project_identity_state WHERE project_id = p_project_id;
  IF v_source = 'legacy' THEN PERFORM project_identity_private.sync_legacy(p_project_id); END IF;

  IF NOT (
    project_identity_private.is_manager(p_project_id, p_actor)
    OR project_identity_private.is_member(p_project_id, p_actor)
    OR (p_invitation_acceptance AND p_action = 'add' AND p_actor = p_user_id)
  ) THEN RAISE EXCEPTION 'Membership change denied' USING ERRCODE = '42501'; END IF;

  SELECT role INTO v_target_role FROM public.project_members WHERE project_id = p_project_id AND user_id = p_user_id;
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_project_id
    AND user_id = p_actor AND role = 'lead') INTO v_actor_lead;

  IF p_action = 'transfer' AND NOT (v_actor_lead OR project_identity_private.is_manager(p_project_id, p_actor)) THEN
    RAISE EXCEPTION 'Only the lead or an organizer can transfer ownership' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'remove' AND v_target_role = 'lead' THEN
    RAISE EXCEPTION 'Transfer ownership before removing the lead' USING ERRCODE = '23514';
  END IF;
  IF (p_action = 'add' AND v_target_role IS NOT NULL)
    OR (p_action = 'remove' AND v_target_role IS NULL)
    OR (p_action = 'transfer' AND v_target_role = 'lead') THEN
    SELECT revision INTO v_revision FROM project_identity_private.project_identity_state WHERE project_id = p_project_id;
    RETURN v_revision;
  END IF;
  IF p_action IN ('add', 'transfer') THEN
    PERFORM project_identity_private.assert_eligible(p_project_id, p_user_id);
  END IF;
  IF p_action = 'transfer' AND v_target_role IS NULL THEN
    RAISE EXCEPTION 'The new lead must already be a member' USING ERRCODE = '23514';
  END IF;

  IF v_source = 'legacy' THEN
    PERFORM project_identity_private.write_legacy_member(p_project_id, p_action, p_user_id);
    -- Refuse a successful-looking mutation when ambiguous emails prevented mapping.
    IF p_action IN ('add', 'transfer') AND NOT EXISTS (
      SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = p_user_id
        AND (p_action = 'add' OR role = 'lead')
    ) THEN RAISE EXCEPTION 'Identity requires reconciliation' USING ERRCODE = '55000'; END IF;
  ELSE
    IF p_action = 'add' THEN
      INSERT INTO public.project_members(project_id, user_id, role) VALUES (p_project_id, p_user_id, 'member')
        ON CONFLICT (project_id, user_id) DO NOTHING;
    ELSIF p_action = 'remove' THEN
      DELETE FROM public.project_members WHERE project_id = p_project_id AND user_id = p_user_id;
    ELSE
      UPDATE public.project_members SET role = 'member' WHERE project_id = p_project_id AND role = 'lead';
      UPDATE public.project_members SET role = 'lead' WHERE project_id = p_project_id AND user_id = p_user_id;
      UPDATE project_identity_private.project_identity_state SET lead_unclaimed = false WHERE project_id = p_project_id;
    END IF;
    UPDATE project_identity_private.project_identity_state SET revision = revision + 1 WHERE project_id = p_project_id;
  END IF;
  SELECT revision INTO v_revision FROM project_identity_private.project_identity_state WHERE project_id = p_project_id;
  RETURN v_revision;
END;
$fn$;

-- Ordinary RPC: there is deliberately no caller-supplied actor parameter.
CREATE FUNCTION public.project_member_change(p_project_id uuid, p_action text, p_user_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT project_identity_private.change_member(p_project_id, p_action, p_user_id, auth.uid());
$fn$;

-- Trusted API/agent wrapper. The server must verify actor and event scope first.
CREATE FUNCTION public.project_member_change_as(p_project_id uuid, p_action text, p_user_id uuid, p_actor uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT project_identity_private.change_member(p_project_id, p_action, p_user_id, p_actor);
$fn$;

-- Isolate column-specific insertion so M4 can retire the compatibility storage.
CREATE FUNCTION project_identity_private.insert_project(p_id uuid, p_lead uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_lead;
  INSERT INTO public.projects (
    id, lead_name, lead_email, teammates, event_id, project_name, project_description,
    project_url, additional_materials_url, video_url, cover_image_url, private, submitted
  ) VALUES (
    p_id, 'Team member', v_email, '{}'::text[], (p_data->>'event_id')::uuid,
    p_data->>'project_name', p_data->>'project_description', p_data->>'project_url',
    p_data->>'additional_materials_url', p_data->>'video_url', p_data->>'cover_image_url',
    COALESCE((p_data->>'private')::boolean, false), false
  );
END;
$fn$;

CREATE FUNCTION project_identity_private.create_project(p_id uuid, p_lead uuid, p_data jsonb, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_event uuid; v_phase text;
BEGIN
  PERFORM project_identity_private.assert_account(p_actor);
  PERFORM project_identity_private.assert_account(p_lead);
  IF p_id IS NULL OR p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Project ID and an object payload are required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_data) k(key) WHERE key <> ALL(ARRAY[
    'event_id','project_name','project_description','project_url','additional_materials_url',
    'video_url','cover_image_url','private'
  ])) THEN RAISE EXCEPTION 'Unsupported project fields' USING ERRCODE = '22023'; END IF;
  v_event := (p_data->>'event_id')::uuid;
  IF v_event IS NOT NULL AND NOT public.user_has_event_role(v_event, p_actor) THEN
    RAISE EXCEPTION 'Join the event before creating its project' USING ERRCODE = '42501';
  END IF;
  IF p_actor <> p_lead AND NOT (
    public.is_admin_user(p_actor) OR EXISTS (SELECT 1 FROM public.user_event_roles r
      WHERE r.event_id = v_event AND r.user_id = p_actor AND r.role::text IN ('organizer', 'admin'))
  ) THEN RAISE EXCEPTION 'Cannot create a project for this lead' USING ERRCODE = '42501'; END IF;
  SELECT phase INTO v_phase FROM project_identity_private.rollout WHERE singleton FOR SHARE;
  PERFORM project_identity_private.insert_project(p_id, p_lead, p_data);
  PERFORM project_identity_private.lock_project(p_id);
  PERFORM project_identity_private.assert_eligible(p_id, p_lead);
  IF v_phase IN ('members', 'contracted') THEN
    DELETE FROM public.project_members WHERE project_id = p_id;
    INSERT INTO public.project_members(project_id, user_id, role) VALUES (p_id, p_lead, 'lead');
    UPDATE project_identity_private.project_identity_state
      SET source = 'members', lead_unclaimed = false, revision = revision + 1,
          migrated_at = now(), verified_at = now() WHERE project_id = p_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_id AND user_id = p_lead AND role = 'lead') THEN
    RAISE EXCEPTION 'Lead identity requires reconciliation' USING ERRCODE = '55000';
  END IF;
  RETURN p_id;
END;
$fn$;

CREATE FUNCTION public.project_create_with_lead(p_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.create_project(p_id, auth.uid(), p_data, auth.uid()); $fn$;
CREATE FUNCTION public.project_create_with_lead_as(p_id uuid, p_lead uuid, p_data jsonb, p_actor uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.create_project(p_id, p_lead, p_data, p_actor); $fn$;

-- Constraint triggers check the final transaction state, allowing atomic transfer.
CREATE FUNCTION project_identity_private.check_lead_invariant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_id uuid; v_source text; v_unclaimed boolean; v_leads bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN v_id := OLD.project_id; ELSE v_id := NEW.project_id; END IF;
  SELECT source, lead_unclaimed INTO v_source, v_unclaimed
    FROM project_identity_private.project_identity_state WHERE project_id = v_id;
  IF v_source = 'members' THEN
    SELECT count(*) INTO v_leads FROM public.project_members WHERE project_id = v_id AND role = 'lead';
    IF (v_unclaimed AND v_leads <> 0) OR (NOT v_unclaimed AND v_leads <> 1) THEN
      RAISE EXCEPTION 'Project lead invariant failed' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$fn$;
CREATE CONSTRAINT TRIGGER project_members_lead_invariant
AFTER INSERT OR UPDATE OR DELETE ON public.project_members
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_identity_private.check_lead_invariant();
CREATE CONSTRAINT TRIGGER project_state_lead_invariant
AFTER INSERT OR UPDATE ON project_identity_private.project_identity_state
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_identity_private.check_lead_invariant();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA project_identity_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_member_change(uuid,text,uuid),
  public.project_member_change_as(uuid,text,uuid,uuid), public.project_create_with_lead(uuid,jsonb),
  public.project_create_with_lead_as(uuid,uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_member_change(uuid,text,uuid), public.project_create_with_lead(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_member_change_as(uuid,text,uuid,uuid),
  public.project_create_with_lead_as(uuid,uuid,jsonb,uuid) TO service_role;

COMMIT;
