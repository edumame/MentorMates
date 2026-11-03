-- DEFERRED: keep outside supabase/migrations until the compatible application is live.
-- This is one transaction. See README for the required session acknowledgements.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $owner$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Apply identity migrations as postgres'; END IF;
END; $owner$;

DO $gate$
BEGIN
  IF current_setting('mentormates.identity_release', true) IS DISTINCT FROM 'privacy'
    OR NULLIF(btrim(current_setting('mentormates.compatible_build', true)), '') IS NULL
    OR current_setting('mentormates.identity_exposure_audited', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Privacy cutover requires the compatible build and completed API/view/RPC audit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM project_identity_private.rollout WHERE singleton AND phase = 'expanded') THEN
    RAISE EXCEPTION 'Unexpected identity rollout phase';
  END IF;
END;
$gate$;

-- Cross-table RLS expressions that read protected columns would start raising
-- permission errors after REVOKE. Retire the known redundant policies now;
-- current policies already authorize the same members through definer helpers.
DROP POLICY IF EXISTS "Allow users to create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to read their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to create track relationships for their projects" ON public.project_tracks;
DROP POLICY IF EXISTS "Allow full access for project owners and teammates" ON public.project_tracks;
CREATE FUNCTION public.is_project_lead(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.projects p JOIN auth.users u ON u.id = p_user_id
    WHERE p.id = p_project_id AND p.lead_email = u.email);
$fn$;
REVOKE ALL ON FUNCTION public.is_project_lead(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_lead(uuid,uuid) TO anon, authenticated, service_role;
DO $policies$
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
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* '\m(lead_email|teammates)\M') THEN
    RAISE EXCEPTION 'Review remaining email-based policies before restricting column access';
  END IF;
END;
$policies$;

-- Revoke table AND existing column grants. A table-wide SELECT would override
-- the allowlist, and an earlier individual column grant survives table REVOKE.
REVOKE ALL ON public.projects FROM PUBLIC, anon, authenticated;
DO $columns$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid = 'public.projects'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON public.projects FROM PUBLIC, anon, authenticated', v_columns);
END;
$columns$;
GRANT SELECT (
  id, event_id, project_name, project_description, project_url, additional_materials_url,
  video_url, cover_image_url, contextus_project_id, created_at, private, submitted, submitted_at
) ON public.projects TO anon, authenticated;
GRANT UPDATE (
  project_name, project_description, project_url, additional_materials_url,
  video_url, cover_image_url, private, submitted, submitted_at
) ON public.projects TO authenticated;
GRANT DELETE ON public.projects TO authenticated;
-- Creation and all identity changes must now use the narrow transactional RPCs.

REVOKE SELECT ON public.feedback FROM PUBLIC, anon, authenticated;
DO $columns$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid = 'public.feedback'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%s) ON public.feedback FROM PUBLIC, anon, authenticated', v_columns);
END;
$columns$;
GRANT SELECT (
  id, project_id, event_id, mentor_id, feedback_text, created_at, modifier_field,
  original_feedback_text, specific_ai_suggestion, positive_ai_suggestion, actionable_ai_suggestion
) ON public.feedback TO anon, authenticated;
-- mentor_name is intentionally excluded too: old fallback values can be emails.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_profiles FROM PUBLIC, anon;
DO $profiles$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid = 'public.user_profiles'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON public.user_profiles FROM PUBLIC, anon', v_columns);
  -- Preserve the existing own-profile/admin/event-organizer policy, but fail if
  -- another permissive SELECT policy could still expose all profile emails.
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.user_profiles'::regclass
    AND polpermissive AND polcmd IN ('r', '*')
    AND polname <> 'admins_organizers_and_users_can_select_profiles')
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.user_profiles'::regclass
      AND polname = 'admins_organizers_and_users_can_select_profiles') THEN
    RAISE EXCEPTION 'Review deployed user_profiles policies before cutover';
  END IF;
  IF to_regclass('public.user_profiles_view') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.user_profiles_view FROM PUBLIC, anon, authenticated';
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_columns
      FROM pg_attribute WHERE attrelid = 'public.user_profiles_view'::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON public.user_profiles_view FROM PUBLIC, anon, authenticated', v_columns);
    IF has_any_column_privilege('anon', 'public.user_profiles_view', 'SELECT')
      OR has_any_column_privilege('authenticated', 'public.user_profiles_view', 'SELECT') THEN
      RAISE EXCEPTION 'Inherited profile view privileges must be removed first';
    END IF;
  END IF;
END;
$profiles$;

-- Future profile creation must not derive a display name from contact data or
-- reassign another account's profile on an email conflict. Existing conflicts
-- are kept for private reconciliation; missing profiles degrade to generic names.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_name text; v_email text;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' OR NEW.confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  v_email := lower(btrim(NEW.email));
  v_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''));
  IF v_name IS NULL OR position('@' IN v_name) > 0 THEN v_name := 'Team member'; END IF;
  INSERT INTO public.user_profiles(uid, email, display_name, created_at)
    VALUES (NEW.id, v_email, v_name, COALESCE(NEW.created_at, now()))
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE v_role text; v_column text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.projects', 'SELECT')
      OR has_table_privilege(v_role, 'public.projects', 'INSERT')
      OR has_table_privilege(v_role, 'public.projects', 'UPDATE')
      OR has_table_privilege(v_role, 'public.feedback', 'SELECT') THEN
      RAISE EXCEPTION 'Inherited table-wide grants defeat the privacy boundary for %', v_role;
    END IF;
    FOREACH v_column IN ARRAY ARRAY['lead_email', 'teammates', 'lead_name'] LOOP
      IF has_column_privilege(v_role, 'public.projects', v_column, 'SELECT')
        OR has_column_privilege(v_role, 'public.projects', v_column, 'INSERT')
        OR has_column_privilege(v_role, 'public.projects', v_column, 'UPDATE') THEN
        RAISE EXCEPTION 'Protected project column remains accessible to %', v_role;
      END IF;
    END LOOP;
    IF has_column_privilege(v_role, 'public.feedback', 'mentor_email', 'SELECT')
      OR has_column_privilege(v_role, 'public.feedback', 'mentor_name', 'SELECT') THEN
      RAISE EXCEPTION 'Protected feedback identity remains readable by %', v_role;
    END IF;
  END LOOP;
  IF has_any_column_privilege('anon', 'public.user_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'Inherited anonymous profile privileges must be removed first';
  END IF;
END;
$verify$;

UPDATE project_identity_private.rollout SET phase = 'privacy',
  compatible_build = current_setting('mentormates.compatible_build'), updated_at = now() WHERE singleton;
NOTIFY pgrst, 'reload schema';
COMMIT;
