-- M1b: install transition machinery. No backfill or authority cutover is executed.
-- Legacy project grants and public.is_project_member remain unchanged in this phase.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

CREATE FUNCTION project_identity_private.lock_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  -- Universal lock order: project, then its private state. Parent writes already
  -- own this lock when invoked by the project trigger.
  PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO project_identity_private.project_identity_state (project_id)
    VALUES (p_project_id) ON CONFLICT (project_id) DO NOTHING;
  PERFORM 1 FROM project_identity_private.project_identity_state
    WHERE project_id = p_project_id FOR UPDATE;
END;
$fn$;

CREATE FUNCTION project_identity_private.is_manager(p_project_id uuid, p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT p_actor IS NOT NULL AND (
    COALESCE(public.is_admin_user(p_actor), false)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_event_roles r ON r.event_id = p.event_id
      WHERE p.id = p_project_id AND r.user_id = p_actor
        AND r.role::text IN ('organizer', 'admin')
    )
  );
$fn$;

CREATE FUNCTION project_identity_private.is_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  SELECT source INTO v_source FROM project_identity_private.project_identity_state
    WHERE project_id = p_project_id;
  IF v_source = 'members' THEN
    RETURN EXISTS (SELECT 1 FROM public.project_members
      WHERE project_id = p_project_id AND user_id = p_user_id);
  ELSIF v_source = 'legacy' THEN
    -- Preserve the original exact-email authorization while legacy is authoritative.
    RETURN EXISTS (
      SELECT 1 FROM public.projects p JOIN auth.users u ON u.id = p_user_id
      WHERE p.id = p_project_id
        AND (p.lead_email = u.email OR u.email = ANY(p.teammates))
    );
  END IF;
  RETURN false; -- Missing state must never revive legacy access after cutover.
END;
$fn$;

CREATE FUNCTION project_identity_private.legacy_candidates(p_project_id uuid)
RETURNS TABLE (
  legacy_role text, normalized_email text, original_emails text[],
  resolved_user_id uuid, reason text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  WITH raw AS (
    SELECT 'lead'::text AS role, COALESCE(p.lead_email, '') AS email
      FROM public.projects p WHERE p.id = p_project_id
    UNION ALL
    SELECT 'member', COALESCE(t.email, '')
      FROM public.projects p
      CROSS JOIN LATERAL unnest(COALESCE(p.teammates, '{}'::text[])) t(email)
      WHERE p.id = p_project_id
  ), grouped AS (
    SELECT role, lower(btrim(email)) AS email,
      array_agg(DISTINCT email ORDER BY email) AS originals
    FROM raw GROUP BY role, lower(btrim(email))
  ), matched AS (
    SELECT g.*,
      a.ids, a.verified_count,
      CASE WHEN cardinality(a.ids) = 1 THEN a.ids[1] END AS candidate
    FROM grouped g
    CROSS JOIN LATERAL (
      SELECT array_agg(u.id ORDER BY u.id) AS ids,
        count(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL) AS verified_count
      FROM auth.users u
      WHERE lower(btrim(u.email)) = g.email AND u.deleted_at IS NULL
    ) a
  ), classified AS (
    SELECT m.*,
      CASE
        WHEN email = '' THEN 'empty'
        WHEN email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN 'invalid'
        WHEN COALESCE(cardinality(ids), 0) = 0 THEN 'missing_account'
        WHEN cardinality(ids) > 1 THEN 'ambiguous_account'
        WHEN verified_count <> 1 THEN 'unverified'
        WHEN EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE (lower(btrim(up.email)) = m.email AND up.uid <> m.candidate)
             OR (up.uid = m.candidate AND up.email IS NOT NULL
                 AND lower(btrim(up.email)) <> m.email)
        ) THEN 'profile_conflict'
        ELSE 'matched'
      END AS match_reason
    FROM matched m
  )
  SELECT role, email, originals,
    CASE WHEN match_reason = 'matched' THEN candidate END,
    match_reason
  FROM classified;
$fn$;

CREATE FUNCTION project_identity_private.sync_legacy(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text;
BEGIN
  PERFORM project_identity_private.lock_project(p_project_id);
  SELECT source INTO v_source FROM project_identity_private.project_identity_state
    WHERE project_id = p_project_id;
  IF v_source <> 'legacy' THEN
    RAISE EXCEPTION 'Legacy synchronization is forbidden for converted projects'
      USING ERRCODE = '55000';
  END IF;

  -- Refresh the complete candidate snapshot under the project lock. Never just
  -- upsert shadow memberships: that would leave removed members behind.
  DELETE FROM project_identity_private.project_identity_reconciliation r
    WHERE r.project_id = p_project_id AND NOT EXISTS (
      SELECT 1 FROM project_identity_private.legacy_candidates(p_project_id) c
      WHERE c.legacy_role = r.legacy_role AND c.normalized_email = r.normalized_email
    );
  INSERT INTO project_identity_private.project_identity_reconciliation
    (project_id, legacy_role, normalized_email, original_emails, resolved_user_id, reason)
  SELECT p_project_id, legacy_role, normalized_email, original_emails, resolved_user_id, reason
    FROM project_identity_private.legacy_candidates(p_project_id)
  ON CONFLICT (project_id, legacy_role, normalized_email) DO UPDATE SET
    original_emails = EXCLUDED.original_emails,
    resolved_user_id = EXCLUDED.resolved_user_id,
    reason = EXCLUDED.reason,
    last_seen_at = now();

  -- A lead wins over the same user also appearing in the teammate array.
  DELETE FROM public.project_members pm WHERE pm.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1 FROM project_identity_private.project_identity_reconciliation r
      WHERE r.project_id = p_project_id AND r.reason = 'matched'
        AND r.resolved_user_id = pm.user_id
    );
  -- Demote before promoting to respect the immediate partial unique lead index.
  UPDATE public.project_members SET role = 'member' WHERE project_id = p_project_id AND role = 'lead';
  INSERT INTO public.project_members (project_id, user_id, role)
    SELECT p_project_id, resolved_user_id,
      CASE WHEN bool_or(legacy_role = 'lead') THEN 'lead' ELSE 'member' END
    FROM project_identity_private.project_identity_reconciliation
    WHERE project_id = p_project_id AND reason = 'matched'
    GROUP BY resolved_user_id
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE project_identity_private.project_identity_state
    SET revision = revision + 1,
        lead_unclaimed = NOT EXISTS (
          SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND role = 'lead'
        ),
        verified_at = NULL
    WHERE project_id = p_project_id;
END;
$fn$;

CREATE FUNCTION project_identity_private.on_project_identity_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_source text;
BEGIN
  PERFORM project_identity_private.lock_project(NEW.id);
  SELECT source INTO v_source FROM project_identity_private.project_identity_state
    WHERE project_id = NEW.id;
  IF v_source = 'members' THEN
    IF TG_OP = 'UPDATE' AND (
      NEW.lead_email IS DISTINCT FROM OLD.lead_email
      OR NEW.teammates IS DISTINCT FROM OLD.teammates
    ) THEN
      RAISE EXCEPTION 'Use UUID membership operations for this project' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- Only initialized/touched projects are synchronized here. There is no
  -- table-wide data migration hidden in this DDL.
  PERFORM project_identity_private.sync_legacy(NEW.id);
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER project_identity_sync
AFTER INSERT OR UPDATE OF lead_email, teammates ON public.projects
FOR EACH ROW EXECUTE FUNCTION project_identity_private.on_project_identity_write();

CREATE FUNCTION public.project_identity_backfill_batch(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 1)
RETURNS TABLE(project_id uuid, revision bigint, unresolved_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_id uuid; v_max integer; v_paused boolean; v_after uuid; v_processed boolean := false;
BEGIN
  SELECT max_batch_size, backfill_paused, COALESCE(p_after, backfill_after)
    INTO v_max, v_paused, v_after
    FROM project_identity_private.rollout WHERE singleton FOR UPDATE;
  IF v_paused THEN RAISE EXCEPTION 'Identity backfill is paused' USING ERRCODE = '55000'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > v_max THEN
    RAISE EXCEPTION 'Invalid backfill batch size' USING ERRCODE = '22023';
  END IF;
  FOR v_id IN
    SELECT p.id FROM public.projects p
    LEFT JOIN project_identity_private.project_identity_state s ON s.project_id = p.id
    WHERE (v_after IS NULL OR p.id > v_after) AND (s.source IS NULL OR s.source = 'legacy')
    ORDER BY p.id LIMIT p_limit
  LOOP
    v_processed := true;
    PERFORM project_identity_private.lock_project(v_id);
    -- A converter may have committed while this worker waited for the lock.
    IF EXISTS (SELECT 1 FROM project_identity_private.project_identity_state s
      WHERE s.project_id = v_id AND s.source = 'legacy') THEN
      PERFORM project_identity_private.sync_legacy(v_id);
    END IF;
    RETURN QUERY SELECT s.project_id, s.revision,
      (SELECT count(*) FROM project_identity_private.project_identity_reconciliation r
        WHERE r.project_id = s.project_id AND r.reason <> 'matched')
      FROM project_identity_private.project_identity_state s WHERE s.project_id = v_id;
    UPDATE project_identity_private.rollout SET backfill_after = v_id, backfill_finished_at = NULL,
      updated_at = now() WHERE singleton;
  END LOOP;
  IF NOT v_processed THEN
    UPDATE project_identity_private.rollout SET backfill_finished_at = now(), backfill_paused = true,
      updated_at = now() WHERE singleton;
  END IF;
END;
$fn$;

CREATE FUNCTION public.project_identity_pause_backfill()
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  UPDATE project_identity_private.rollout SET backfill_paused = true, updated_at = now()
    WHERE singleton;
$fn$;

-- Public RPC supplies only UUIDs/roles and a count; private contact data stays
-- behind the service-only grant. The API must authorize projects before enrichment.
CREATE FUNCTION project_identity_private.read_rows(p_project_ids uuid[])
RETURNS TABLE (
  project_id uuid, source text, user_id uuid, role text,
  unresolved_member_count bigint, revision bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT s.project_id, s.source, m.user_id, m.role,
    CASE WHEN s.source = 'legacy' THEN (
      SELECT count(*) FROM project_identity_private.legacy_candidates(s.project_id) c
      WHERE c.reason <> 'matched'
    ) ELSE (
      SELECT count(*) FROM project_identity_private.project_identity_reconciliation r
      WHERE r.project_id = s.project_id AND r.reason <> 'matched'
    ) END,
    s.revision
  FROM (
    SELECT p.id AS project_id, COALESCE(st.source, 'legacy') AS source,
      COALESCE(st.revision, 0) AS revision
    FROM public.projects p
    LEFT JOIN project_identity_private.project_identity_state st ON st.project_id = p.id
    WHERE p.id = ANY(p_project_ids)
  ) s
  LEFT JOIN LATERAL (
    SELECT pm.user_id, pm.role FROM public.project_members pm
      WHERE pm.project_id = s.project_id AND s.source = 'members'
    UNION ALL
    SELECT c.resolved_user_id,
      CASE WHEN bool_or(c.legacy_role = 'lead') THEN 'lead' ELSE 'member' END
      FROM project_identity_private.legacy_candidates(s.project_id) c
      WHERE s.source = 'legacy' AND c.reason = 'matched'
      GROUP BY c.resolved_user_id
  ) m ON true
  WHERE s.project_id = ANY(p_project_ids)
  ORDER BY s.project_id, m.role, m.user_id;
$fn$;

CREATE FUNCTION public.project_identity_read(
  p_project_ids uuid[], p_after text DEFAULT NULL, p_limit integer DEFAULT 500
)
RETURNS TABLE (
  project_id uuid, source text, user_id uuid, role text,
  unresolved_member_count bigint, revision bigint, next_cursor text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  IF p_project_ids IS NULL OR cardinality(p_project_ids) > 100
    OR array_position(p_project_ids, NULL) IS NOT NULL
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Supply at most 100 project IDs and a page size from 1 to 500' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects p
    LEFT JOIN project_identity_private.project_identity_state s ON s.project_id = p.id
    WHERE p.id = ANY(p_project_ids) AND s.project_id IS NULL AND EXISTS (
      SELECT 1 FROM project_identity_private.rollout WHERE phase IN ('members', 'contracted')
    )) THEN
    RAISE EXCEPTION 'Authoritative identity state is unavailable' USING ERRCODE = '55000';
  END IF;
  RETURN QUERY SELECT r.project_id, r.source, r.user_id, r.role, r.unresolved_member_count, r.revision, k.cursor
    FROM project_identity_private.read_rows(p_project_ids) r
    CROSS JOIN LATERAL (SELECT r.project_id::text || '/' || COALESCE(r.role, '') || '/' || COALESCE(r.user_id::text, '') AS cursor) k
    WHERE p_after IS NULL OR k.cursor COLLATE "C" > p_after COLLATE "C"
    ORDER BY k.cursor COLLATE "C" LIMIT p_limit;
END;
$fn$;

CREATE FUNCTION public.project_identity_backfill_progress()
RETURNS TABLE(phase text, paused boolean, after_project_id uuid, finished_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT r.phase, r.backfill_paused, r.backfill_after, r.backfill_finished_at FROM project_identity_private.rollout r WHERE r.singleton;
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA project_identity_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_identity_backfill_batch(uuid, integer),
  public.project_identity_pause_backfill(), public.project_identity_read(uuid[],text,integer),
  public.project_identity_backfill_progress()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_identity_backfill_batch(uuid, integer),
  public.project_identity_pause_backfill(), public.project_identity_read(uuid[],text,integer),
  public.project_identity_backfill_progress() TO service_role;

COMMIT;
