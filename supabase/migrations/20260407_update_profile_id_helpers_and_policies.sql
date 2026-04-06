-- Migration: Update auth/profile helpers and RLS for profile-backed foreign keys
-- Description: Adds auth->profile lookup helpers, keeps signup merges stable on
-- user_profiles.id, and updates active RLS policies to compare against profile ids.

-- Resolve an auth.users id to the stable user_profiles.id.
CREATE OR REPLACE FUNCTION public.auth_user_profile_id(p_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.uid = p_auth_user_id
  LIMIT 1;
$$;

-- Convenience wrapper for the current authenticated user.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
  SELECT public.auth_user_profile_id(auth.uid());
$$;

-- Compatibility helper for policy checks on profile-backed user ids.
CREATE OR REPLACE FUNCTION public.auth_user_owns_profile(
  p_profile_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.auth_user_profile_id(p_auth_user_id) = p_profile_id;
$$;

-- Child tables now point at user_profiles.id, so no repointing is needed when
-- a placeholder profile is linked to an auth user.
CREATE OR REPLACE FUNCTION public.repoint_user_profile_references(
  p_old_user_id uuid,
  p_new_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN;
END;
$$;

-- On auth signup, either create a profile row or attach the auth uid to an
-- existing placeholder profile matched by email. The stable profile id never changes.
CREATE OR REPLACE FUNCTION public.merge_user_profile_on_auth_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_existing_profile record;
  v_display_name text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  SELECT
    up.id,
    up.uid
  INTO v_existing_profile
  FROM public.user_profiles up
  WHERE lower(up.email) = lower(NEW.email)
  ORDER BY up.created_at NULLS FIRST, up.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      uid,
      email,
      display_name,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_display_name,
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (uid) DO UPDATE
    SET
      email = EXCLUDED.email,
      display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name);

    RETURN NEW;
  END IF;

  UPDATE public.user_profiles
  SET
    uid = NEW.id,
    email = NEW.email,
    display_name = COALESCE(public.user_profiles.display_name, v_display_name)
  WHERE id = v_existing_profile.id;

  RETURN NEW;
END;
$$;

-- Helper function to check if a user is an organizer for an event.
CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_user_profile_id(p_user_id);

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = p_event_id
      AND user_id = v_profile_id
      AND role = 'organizer'
  );
END;
$$;

-- Helper function to check if a user has any role in an event.
CREATE OR REPLACE FUNCTION public.user_has_event_role(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_user_profile_id(p_user_id);

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = p_event_id
      AND user_id = v_profile_id
  );
END;
$$;

-- Helper function to check if a user is a judge for an event.
CREATE OR REPLACE FUNCTION public.is_event_judge(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_user_profile_id(p_user_id);

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = p_event_id
      AND user_id = v_profile_id
      AND role = 'judge'
  );
END;
$$;

-- Helper function to check if a user is a judge or organizer for an event.
CREATE OR REPLACE FUNCTION public.is_event_judge_or_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_user_profile_id(p_user_id);

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE event_id = p_event_id
      AND user_id = v_profile_id
      AND role IN ('judge', 'organizer')
  );
END;
$$;

-- Helper function to check if a user is an organizer for a track's event.
CREATE OR REPLACE FUNCTION public.is_track_event_organizer(p_track_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := public.auth_user_profile_id(p_user_id);

  RETURN EXISTS (
    SELECT 1
    FROM public.event_tracks et
    INNER JOIN public.user_event_roles uer
      ON et.event_id = uer.event_id
    WHERE et.track_id = p_track_id
      AND uer.user_id = v_profile_id
      AND uer.role = 'organizer'
  );
END;
$$;

-- user_profiles RLS must now match organizer visibility through user_profiles.id.
DROP POLICY IF EXISTS "admins_organizers_and_users_can_select_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_insert_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_delete_own_profile" ON public.user_profiles;

CREATE POLICY "admins_organizers_and_users_can_select_profiles"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        is_admin_user(auth.uid())
        OR uid = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_event_roles uer
            WHERE uer.user_id = user_profiles.id
              AND public.is_event_organizer(uer.event_id, auth.uid())
        )
    );

CREATE POLICY "admins_and_users_can_insert_own_profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

CREATE POLICY "admins_and_users_can_update_own_profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    )
    WITH CHECK (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

CREATE POLICY "admins_and_users_can_delete_own_profile"
    ON public.user_profiles
    FOR DELETE
    TO authenticated
    USING (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

-- user_event_roles policies must compare row ownership to the current profile id.
DROP POLICY IF EXISTS "Users and event organizers can assign roles to events" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can update their own roles and organizers can update any role" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can remove their own roles and organizers can remove any role" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users, organizers, and admins can assign roles to events" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users, organizers, and admins can update roles" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users, organizers, and admins can remove roles" ON public.user_event_roles;

CREATE POLICY "Users, organizers, and admins can assign roles to events"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Users, organizers, and admins can update roles"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Users, organizers, and admins can remove roles"
ON public.user_event_roles
FOR DELETE
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Payment rows now store profile ids instead of auth ids.
DROP POLICY IF EXISTS "Users can view own payments" ON public.user_event_payments;
DROP POLICY IF EXISTS "Users can create own payments" ON public.user_event_payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.user_event_payments;
DROP POLICY IF EXISTS "Organizers can view event payments" ON public.user_event_payments;
DROP POLICY IF EXISTS "Users can view their own payment records" ON public.user_event_payments;

CREATE POLICY "Users can view own payments"
ON public.user_event_payments
FOR SELECT
TO authenticated
USING (public.current_profile_id() = user_id);

CREATE POLICY "Users can create own payments"
ON public.user_event_payments
FOR INSERT
TO authenticated
WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Users can update own payments"
ON public.user_event_payments
FOR UPDATE
TO authenticated
USING (public.current_profile_id() = user_id)
WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Organizers can view event payments"
ON public.user_event_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE user_id = public.current_profile_id()
      AND event_id = public.user_event_payments.event_id
      AND role = 'organizer'
  )
);

CREATE POLICY "Users can view their own payment records"
ON public.user_event_payments
FOR SELECT
TO authenticated
USING (public.current_profile_id() = user_id);

-- Tickets now use profile ids for purchaser and assignee.
DROP POLICY IF EXISTS "Users can view tickets they purchased or were assigned, organizers can view all event tickets, and admins can view all tickets" ON public.event_tickets;
DROP POLICY IF EXISTS "Users can update tickets they purchased or were assigned" ON public.event_tickets;
DROP POLICY IF EXISTS "Users can delete tickets they purchased or were assigned" ON public.event_tickets;

CREATE POLICY "Users can view tickets they purchased or were assigned, organizers can view all event tickets, and admins can view all tickets"
ON public.event_tickets
FOR SELECT
TO authenticated
USING (
  purchased_by_user_id = public.current_profile_id()
  OR assigned_to_user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Users can update tickets they purchased or were assigned"
ON public.event_tickets
FOR UPDATE
TO authenticated
USING (
  purchased_by_user_id = public.current_profile_id()
  OR assigned_to_user_id = public.current_profile_id()
)
WITH CHECK (
  purchased_by_user_id = public.current_profile_id()
  OR assigned_to_user_id = public.current_profile_id()
);

CREATE POLICY "Users can delete tickets they purchased or were assigned"
ON public.event_tickets
FOR DELETE
TO authenticated
USING (
  purchased_by_user_id = public.current_profile_id()
  OR assigned_to_user_id = public.current_profile_id()
);

-- Project assignment ownership now compares against profile ids.
DROP POLICY IF EXISTS "Users can view own assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Organizers can manage assignments" ON public.project_assignments;

CREATE POLICY "Users can view own assignments"
ON public.project_assignments
FOR SELECT
TO authenticated
USING (public.current_profile_id() = user_id);

CREATE POLICY "Organizers can manage assignments"
ON public.project_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    JOIN public.projects p
      ON p.event_id = uer.event_id
    WHERE uer.user_id = public.current_profile_id()
      AND p.id = project_assignments.project_id
      AND uer.role IN ('organizer', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    JOIN public.projects p
      ON p.event_id = uer.event_id
    WHERE uer.user_id = public.current_profile_id()
      AND p.id = project_assignments.project_id
      AND uer.role IN ('organizer', 'admin')
  )
);

-- Participant approval requests are keyed by profile id.
DROP POLICY IF EXISTS "Users can create own requests" ON public.participant_approval_requests;
DROP POLICY IF EXISTS "View approval requests" ON public.participant_approval_requests;
DROP POLICY IF EXISTS "Update approval requests" ON public.participant_approval_requests;

CREATE POLICY "Users can create own requests"
    ON public.participant_approval_requests
    FOR INSERT
    WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "View approval requests"
    ON public.participant_approval_requests
    FOR SELECT
    USING (
        public.current_profile_id() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles
            WHERE user_event_roles.event_id = participant_approval_requests.event_id
              AND user_event_roles.user_id = public.current_profile_id()
              AND user_event_roles.role IN ('organizer')
        )
        OR is_admin_user(auth.uid())
    );

CREATE POLICY "Update approval requests"
    ON public.participant_approval_requests
    FOR UPDATE
    USING (
        (public.current_profile_id() = user_id AND (status = 'pending' OR status = 'withdrawn'))
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles
            WHERE user_event_roles.event_id = participant_approval_requests.event_id
              AND user_event_roles.user_id = public.current_profile_id()
              AND user_event_roles.role IN ('organizer')
        )
        OR is_admin_user(auth.uid())
    )
    WITH CHECK (
        (public.current_profile_id() = user_id AND (status = 'withdrawn' OR status = 'pending'))
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles
            WHERE user_event_roles.event_id = participant_approval_requests.event_id
              AND user_event_roles.user_id = public.current_profile_id()
              AND user_event_roles.role IN ('organizer')
        )
        OR is_admin_user(auth.uid())
    );

-- Phone number ownership now uses profile ids.
DROP POLICY IF EXISTS "Users can view own phone numbers" ON public.user_phone_numbers;
DROP POLICY IF EXISTS "Users can insert own phone numbers" ON public.user_phone_numbers;
DROP POLICY IF EXISTS "Users can update own phone numbers" ON public.user_phone_numbers;
DROP POLICY IF EXISTS "Users can delete own phone numbers" ON public.user_phone_numbers;

CREATE POLICY "Users can view own phone numbers"
ON public.user_phone_numbers
FOR SELECT
TO authenticated
USING (public.current_profile_id() = user_id);

CREATE POLICY "Users can insert own phone numbers"
ON public.user_phone_numbers
FOR INSERT
TO authenticated
WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Users can update own phone numbers"
ON public.user_phone_numbers
FOR UPDATE
TO authenticated
USING (public.current_profile_id() = user_id)
WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Users can delete own phone numbers"
ON public.user_phone_numbers
FOR DELETE
TO authenticated
USING (public.current_profile_id() = user_id);

-- Agent API keys are now owned by profile id.
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.agent_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.agent_api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.agent_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.agent_api_keys;

CREATE POLICY "Users can view their own API keys"
  ON public.agent_api_keys FOR SELECT
  USING (public.current_profile_id() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON public.agent_api_keys FOR INSERT
  WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.agent_api_keys FOR UPDATE
  USING (public.current_profile_id() = user_id)
  WITH CHECK (public.current_profile_id() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.agent_api_keys FOR DELETE
  USING (public.current_profile_id() = user_id);

-- Intake form submission ownership now uses profile ids.
DROP POLICY IF EXISTS "Participants can create own intake submissions" ON public.intake_form_submissions;
DROP POLICY IF EXISTS "Participants and organizers can view intake submissions" ON public.intake_form_submissions;
DROP POLICY IF EXISTS "Participants can update own draft intake submissions" ON public.intake_form_submissions;

CREATE POLICY "Participants can create own intake submissions"
ON public.intake_form_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitter_user_id = public.current_profile_id()
);

CREATE POLICY "Participants and organizers can view intake submissions"
ON public.intake_form_submissions
FOR SELECT
TO authenticated
USING (
  submitter_user_id = public.current_profile_id()
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Participants can update own draft intake submissions"
ON public.intake_form_submissions
FOR UPDATE
TO authenticated
USING (
  submitter_user_id = public.current_profile_id()
  AND status = 'draft'
)
WITH CHECK (
  submitter_user_id = public.current_profile_id()
);

DROP POLICY IF EXISTS "Participants and organizers can view intake answers" ON public.intake_form_submission_answers;
DROP POLICY IF EXISTS "Participants can insert answers for own submissions" ON public.intake_form_submission_answers;
DROP POLICY IF EXISTS "Participants can update answers for own draft submissions" ON public.intake_form_submission_answers;

CREATE POLICY "Participants and organizers can view intake answers"
ON public.intake_form_submission_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND (
        s.submitter_user_id = public.current_profile_id()
        OR public.is_event_organizer(s.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Participants can insert answers for own submissions"
ON public.intake_form_submission_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = public.current_profile_id()
  )
);

CREATE POLICY "Participants can update answers for own draft submissions"
ON public.intake_form_submission_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = public.current_profile_id()
      AND s.status = 'draft'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = public.current_profile_id()
  )
);

-- Event coupon organizer access must now resolve through profile ids.
DROP POLICY IF EXISTS "Event organizers can manage their event coupons" ON public.coupons;

CREATE POLICY "Event organizers can manage their event coupons"
ON public.coupons
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.user_id = public.current_profile_id()
      AND uer.event_id = public.coupons.event_id
      AND uer.role = 'organizer'
  )
);

-- Event lessons membership checks now use profile ids.
DROP POLICY IF EXISTS "read_event_lessons_for_event_members" ON public.event_lessons;
DROP POLICY IF EXISTS "modify_event_lessons_for_organizers" ON public.event_lessons;

CREATE POLICY "read_event_lessons_for_event_members"
ON public.event_lessons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = public.current_profile_id()
  )
);

CREATE POLICY "modify_event_lessons_for_organizers"
ON public.event_lessons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = public.current_profile_id()
      AND uer.role IN ('organizer', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = event_lessons.event_id
      AND uer.user_id = public.current_profile_id()
      AND uer.role IN ('organizer', 'admin')
  )
);

-- Storage organizer upload access is also keyed through user_event_roles.
DROP POLICY IF EXISTS "upload organizer 1201s55_0" ON storage.objects;

CREATE POLICY "upload organizer 1201s55_0"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'event-materials'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.user_event_roles
    WHERE user_event_roles.user_id = public.current_profile_id()
      AND user_event_roles.role = ANY (ARRAY['organizer'::public.event_role, 'admin'::public.event_role])
  )
);
