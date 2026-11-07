-- Apply before deploying PATCH /api/projects/[projectId]/tracks (organizer track override).
-- Additive: creates one service-only function; no table or policy changes.
--
-- The route performs caller authorization (event organizer-or-higher, or platform
-- admin) and then calls this function with the service-role client. Running the
-- replacement here makes it atomic (a failure rolls back the whole swap, so a project
-- is never left with no tracks) and independent of project_tracks RLS, which only
-- admits event organizers and project members, not platform admins.
BEGIN;
CREATE FUNCTION public.replace_project_tracks(p_project_id uuid, p_track_ids uuid[])
RETURNS TABLE (previous_track_ids uuid[], track_ids uuid[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_requested uuid[];
  v_previous uuid[];
  v_final uuid[];
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'A project ID is required' USING ERRCODE = '22023';
  END IF;

  -- An empty array is valid and clears all tracks; NULL (or NULL elements) is not.
  IF p_track_ids IS NULL OR pg_catalog.array_position(p_track_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Track IDs must be a non-null array of non-null UUIDs' USING ERRCODE = '22023';
  END IF;

  -- Lock the project row so concurrent replacements for the same project serialize.
  SELECT p.event_id INTO v_event_id
  FROM public.projects AS p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Project is not associated with an event' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(DISTINCT r.track_id), '{}'::uuid[]) INTO v_requested
  FROM pg_catalog.unnest(p_track_ids) AS r(track_id);

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(v_requested) AS r(track_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.event_tracks AS et
      WHERE et.track_id = r.track_id
        AND et.event_id = v_event_id
    )
  ) THEN
    RAISE EXCEPTION 'One or more tracks do not belong to this project''s event' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(pt.track_id ORDER BY pt.track_id), '{}'::uuid[]) INTO v_previous
  FROM public.project_tracks AS pt
  WHERE pt.project_id = p_project_id;

  DELETE FROM public.project_tracks AS pt
  WHERE pt.project_id = p_project_id
    AND pt.track_id <> ALL (v_requested);

  -- project_tracks has no unique constraint on (project_id, track_id), so guard
  -- against duplicates explicitly instead of relying on ON CONFLICT.
  INSERT INTO public.project_tracks (project_id, track_id)
  SELECT p_project_id, r.track_id
  FROM pg_catalog.unnest(v_requested) AS r(track_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.project_tracks AS pt
    WHERE pt.project_id = p_project_id
      AND pt.track_id = r.track_id
  );

  SELECT COALESCE(pg_catalog.array_agg(DISTINCT pt.track_id ORDER BY pt.track_id), '{}'::uuid[]) INTO v_final
  FROM public.project_tracks AS pt
  WHERE pt.project_id = p_project_id;

  RETURN QUERY SELECT v_previous, v_final;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_project_tracks(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_project_tracks(uuid, uuid[]) TO service_role;
COMMENT ON FUNCTION public.replace_project_tracks(uuid, uuid[]) IS
  'Service-only atomic replacement of a project''s track assignments. Callers must authorize first (organizer track override route). Validates every track belongs to the project''s event; an empty array clears all tracks. Returns the sorted previous and final track sets.';
COMMIT;
