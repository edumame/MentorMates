-- DEFERRED CONTRACT: a separate later release, after every project is converted.
-- Never use this as part of the initial schema expansion or privacy cutover.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

DO $gate$
BEGIN
  IF current_setting('mentormates.identity_release', true) IS DISTINCT FROM 'contract'
    OR current_setting('mentormates.identity_contract_audited', true) IS DISTINCT FROM 'true'
    OR NULLIF(btrim(current_setting('mentormates.compatible_build', true)), '') IS NULL THEN
    RAISE EXCEPTION 'Contract requires an audited dependency inventory and contract-safe rollback build';
  END IF;
  PERFORM 1 FROM project_identity_private.rollout WHERE singleton AND phase = 'members' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unexpected identity rollout phase'; END IF;
  IF EXISTS (SELECT 1 FROM public.projects p
    LEFT JOIN project_identity_private.project_identity_state s ON s.project_id = p.id
    WHERE s.source IS DISTINCT FROM 'members' OR s.verified_at IS NULL) THEN
    RAISE EXCEPTION 'Every project must be verified and use UUID authority before contract';
  END IF;
END;
$gate$;

DROP TRIGGER project_identity_sync ON public.projects;
DROP FUNCTION project_identity_private.on_project_identity_write();

CREATE OR REPLACE FUNCTION project_identity_private.is_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.project_members m
    JOIN project_identity_private.project_identity_state s ON s.project_id = m.project_id
    WHERE m.project_id = p_project_id AND m.user_id = p_user_id AND s.source = 'members');
$fn$;
CREATE OR REPLACE FUNCTION project_identity_private.is_lead(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.project_members m
    JOIN project_identity_private.project_identity_state s ON s.project_id = m.project_id
    WHERE m.project_id = p_project_id AND m.user_id = p_user_id AND m.role = 'lead' AND s.source = 'members');
$fn$;

CREATE OR REPLACE FUNCTION project_identity_private.read_rows(p_project_ids uuid[])
RETURNS TABLE(project_id uuid, source text, user_id uuid, role text, unresolved_member_count bigint, revision bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT s.project_id, s.source, m.user_id, m.role,
    (SELECT count(*) FROM project_identity_private.project_identity_reconciliation r
      WHERE r.project_id = s.project_id AND r.reason <> 'matched'), s.revision
    FROM project_identity_private.project_identity_state s
    LEFT JOIN public.project_members m ON m.project_id = s.project_id
    WHERE s.project_id = ANY(p_project_ids) ORDER BY s.project_id, m.role, m.user_id;
$fn$;

-- Explicit retired-operation errors are safer for stale workers than reviving
-- old data or silently returning success. Keep the internal signatures until the
-- later application cleanup can remove unreachable compatibility branches.
CREATE OR REPLACE FUNCTION project_identity_private.sync_legacy(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ BEGIN RAISE EXCEPTION 'Legacy synchronization has been retired' USING ERRCODE = '55000'; END; $fn$;
CREATE OR REPLACE FUNCTION project_identity_private.write_legacy_member(p_project_id uuid, p_action text, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$ BEGIN RAISE EXCEPTION 'Legacy membership writes have been retired' USING ERRCODE = '55000'; END; $fn$;
DROP FUNCTION project_identity_private.legacy_candidates(uuid);

ALTER TABLE project_identity_private.project_identity_state ALTER COLUMN source SET DEFAULT 'members';
ALTER TABLE project_identity_private.project_identity_state ALTER COLUMN migrated_at SET DEFAULT now();
ALTER TABLE project_identity_private.project_identity_state
  ADD CONSTRAINT project_identity_uuid_only CHECK (source = 'members') NOT VALID;
ALTER TABLE project_identity_private.project_identity_state VALIDATE CONSTRAINT project_identity_uuid_only;
DROP INDEX project_identity_private.project_identity_state_pending_idx;

CREATE FUNCTION project_identity_private.initialize_uuid_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  PERFORM project_identity_private.lock_project(NEW.id);
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER project_identity_initialize AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION project_identity_private.initialize_uuid_project();

DO $dependencies$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* '\m(lead_email|teammates)\M') THEN
    RAISE EXCEPTION 'Legacy policy dependency remains';
  END IF;
  -- PL/pgSQL and string-bodied SQL may not register column dependencies. Detect
  -- those separately; DROP ... RESTRICT below catches catalog-tracked dependents.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'project_identity_private') AND p.prokind IN ('f', 'p')
      AND pg_get_functiondef(p.oid) ~* '\m(lead_email|teammates)\M') THEN
    RAISE EXCEPTION 'Legacy function dependency remains; review before removing columns';
  END IF;
END;
$dependencies$;

ALTER TABLE public.projects DROP COLUMN lead_email RESTRICT;
ALTER TABLE public.projects DROP COLUMN teammates RESTRICT;
-- lead_name remains restricted, pending its separate consumer audit. Private
-- reconciliation and source markers remain for historical claims and access.

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA project_identity_private FROM PUBLIC, anon, authenticated, service_role;
UPDATE project_identity_private.rollout SET phase = 'contracted', backfill_paused = true,
  compatible_build = current_setting('mentormates.compatible_build'), updated_at = now() WHERE singleton;
NOTIFY pgrst, 'reload schema';
COMMIT;
