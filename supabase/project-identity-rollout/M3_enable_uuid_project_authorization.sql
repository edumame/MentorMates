-- DEFERRED: after M2, the paced backfill, and access/concurrency rehearsal.
-- Installs conversion support; does not convert existing projects itself.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

DO $gate$
BEGIN
  IF current_setting('mentormates.identity_release', true) IS DISTINCT FROM 'members'
    OR current_setting('mentormates.identity_authorization_audited', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'UUID authorization requires the completed policy and concurrency rehearsal';
  END IF;
  PERFORM 1 FROM project_identity_private.rollout WHERE singleton AND phase = 'privacy' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Privacy cutover must precede UUID authority'; END IF;
  IF EXISTS (SELECT 1 FROM public.projects p
    LEFT JOIN project_identity_private.project_identity_state s ON s.project_id = p.id
    WHERE s.project_id IS NULL) THEN
    RAISE EXCEPTION 'Initialize all existing project states with the paced backfill first';
  END IF;
END;
$gate$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.is_member(p_project_id, p_user_id); $fn$;

CREATE FUNCTION project_identity_private.is_lead(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM project_identity_private.project_identity_state s WHERE s.project_id = p_project_id
      AND ((s.source = 'members' AND EXISTS (SELECT 1 FROM public.project_members m
        WHERE m.project_id = p_project_id AND m.user_id = p_user_id AND m.role = 'lead'))
      OR (s.source = 'legacy' AND EXISTS (SELECT 1 FROM public.projects p JOIN auth.users u ON u.id = p_user_id
        WHERE p.id = p_project_id AND p.lead_email = u.email)))
  );
$fn$;
CREATE OR REPLACE FUNCTION public.is_project_lead(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ SELECT project_identity_private.is_lead(p_project_id, p_user_id); $fn$;
REVOKE ALL ON FUNCTION public.is_project_member(uuid,uuid), public.is_project_lead(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid,uuid), public.is_project_lead(uuid,uuid)
  TO anon, authenticated, service_role;

-- These historical policies were not removed by the more recent policy migrations.
-- Leaving even one permissive email policy would resurrect removed UUID members.
DROP POLICY IF EXISTS "Allow users to create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to read their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to create track relationships for their projects" ON public.project_tracks;
DROP POLICY IF EXISTS "Allow full access for project owners and teammates" ON public.project_tracks;

DO $policy$
BEGIN
  IF to_regclass('public.platform_engagement') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own entries and entries for events they''re" ON public.platform_engagement';
    EXECUTE $sql$
      CREATE POLICY "Users can view their own entries and entries for events they're"
      ON public.platform_engagement FOR SELECT
      USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.projects p WHERE p.event_id = platform_engagement.event_id
          AND public.is_project_lead(p.id, auth.uid())
      ))
    $sql$;
  END IF;
  -- Fail closed on deployment drift. Unknown policies need an explicit reviewed
  -- replacement, not a blanket DROP of unrelated authorization rules.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* '\m(lead_email|teammates)\M') THEN
    RAISE EXCEPTION 'Unreviewed email-based policy remains; UUID conversion is blocked';
  END IF;
END;
$policy$;

-- In the UUID phase all new inserts get an explicit UUID source immediately.
-- The creation RPC supplies the lead before commit. Unexpected raw inserts stay
-- unclaimed, rather than deriving ownership from an email supplied by a writer.
CREATE OR REPLACE FUNCTION project_identity_private.on_project_identity_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text; v_phase text;
BEGIN
  PERFORM project_identity_private.lock_project(NEW.id);
  SELECT phase INTO v_phase FROM project_identity_private.rollout WHERE singleton;
  IF TG_OP = 'INSERT' AND v_phase IN ('members', 'contracted') THEN
    IF NEW.lead_email IS NOT NULL OR cardinality(COALESCE(NEW.teammates, '{}'::text[])) <> 0 THEN
      RAISE EXCEPTION 'Create projects through the UUID creation operation' USING ERRCODE = '42501';
    END IF;
    UPDATE project_identity_private.project_identity_state
      SET source = 'members', migrated_at = now(), verified_at = now() WHERE project_id = NEW.id;
    RETURN NEW;
  END IF;
  SELECT source INTO v_source FROM project_identity_private.project_identity_state WHERE project_id = NEW.id;
  IF v_source = 'members' THEN
    IF NEW.lead_email IS DISTINCT FROM OLD.lead_email OR NEW.teammates IS DISTINCT FROM OLD.teammates THEN
      RAISE EXCEPTION 'Use UUID membership operations for this project' USING ERRCODE = '42501';
    END IF;
  ELSE
    PERFORM project_identity_private.sync_legacy(NEW.id);
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION project_identity_private.insert_project(p_id uuid, p_lead uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.projects (
    id, lead_name, event_id, project_name, project_description, project_url,
    additional_materials_url, video_url, cover_image_url, private, submitted
  ) VALUES (
    p_id, 'Team member', (p_data->>'event_id')::uuid, p_data->>'project_name',
    p_data->>'project_description', p_data->>'project_url', p_data->>'additional_materials_url',
    p_data->>'video_url', p_data->>'cover_image_url', COALESCE((p_data->>'private')::boolean, false), false
  );
END;
$fn$;

CREATE FUNCTION public.project_identity_convert(
  p_project_id uuid, p_expected_revision bigint, p_expected_user_ids uuid[],
  p_expected_lead uuid, p_allow_unresolved boolean DEFAULT false
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text; v_revision bigint; v_lead uuid;
BEGIN
  -- The controlled runner uses a dedicated transaction/connection with bounded
  -- retries. Serializable isolation also protects mapping reads of auth/profiles.
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'Conversion requires a serializable transaction' USING ERRCODE = '25001';
  END IF;
  PERFORM 1 FROM project_identity_private.rollout WHERE singleton AND phase = 'members' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UUID conversion is not enabled' USING ERRCODE = '55000'; END IF;
  IF p_expected_user_ids IS NULL OR array_position(p_expected_user_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Supply the reviewed UUID set, including an explicit empty array if unclaimed' USING ERRCODE = '22023';
  END IF;
  PERFORM project_identity_private.lock_project(p_project_id);
  SELECT source, revision INTO v_source, v_revision FROM project_identity_private.project_identity_state WHERE project_id = p_project_id;
  IF v_source = 'members' THEN RETURN v_revision; END IF;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Project changed since review; refresh identity mapping' USING ERRCODE = '40001';
  END IF;
  PERFORM project_identity_private.sync_legacy(p_project_id);
  IF EXISTS (
    SELECT 1 FROM project_identity_private.project_identity_reconciliation r WHERE r.project_id = p_project_id
      AND r.reason <> 'matched' AND (NOT COALESCE(p_allow_unresolved, false)
        OR r.reason NOT IN ('empty', 'invalid', 'missing_account'))
  ) THEN RAISE EXCEPTION 'Unresolved identity requires review' USING ERRCODE = '55000'; END IF;
  IF EXISTS (SELECT user_id FROM public.project_members WHERE project_id = p_project_id
    EXCEPT SELECT unnest(p_expected_user_ids))
    OR EXISTS (SELECT unnest(p_expected_user_ids)
    EXCEPT SELECT user_id FROM public.project_members WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Resolved UUID set differs from reviewed membership' USING ERRCODE = '40001';
  END IF;
  SELECT user_id INTO v_lead FROM public.project_members WHERE project_id = p_project_id AND role = 'lead';
  IF v_lead IS DISTINCT FROM p_expected_lead THEN
    RAISE EXCEPTION 'Lead identity differs from reviewed ownership' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u
    WHERE project_identity_private.is_member(p_project_id, u.id)
      AND NOT EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p_project_id AND m.user_id = u.id)) THEN
    RAISE EXCEPTION 'An existing account would lose membership; reconcile before conversion' USING ERRCODE = '55000';
  END IF;
  UPDATE project_identity_private.project_identity_state
    SET source = 'members', lead_unclaimed = (v_lead IS NULL), migrated_at = now(), verified_at = now(), revision = revision + 1
    WHERE project_id = p_project_id RETURNING revision INTO v_revision;
  RETURN v_revision;
END;
$fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA project_identity_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_identity_convert(uuid,bigint,uuid[],uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_identity_convert(uuid,bigint,uuid[],uuid,boolean) TO service_role;

UPDATE project_identity_private.rollout SET phase = 'members', updated_at = now() WHERE singleton;
NOTIFY pgrst, 'reload schema';
COMMIT;
