-- Deploy with the matching role-verification service-client change. Forward-only:
-- do not rewrite migration identifiers already recorded in a deployed database.
DROP POLICY IF EXISTS "Users can create own payments" ON public.user_event_payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.user_event_payments;
REVOKE INSERT, UPDATE, DELETE ON public.user_event_payments FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users, organizers, and admins can assign roles to events" ON public.user_event_roles;
CREATE POLICY "Organizers and admins can assign roles to events"
ON public.user_event_roles FOR INSERT TO authenticated
WITH CHECK (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Public metadata is sufficient for the password prompt. A table-level SELECT
-- grant would override these column grants, so revoke it on every client role.
REVOKE SELECT ON public.role_passwords FROM PUBLIC, anon, authenticated;
GRANT SELECT (event_id, role) ON public.role_passwords TO authenticated;
-- Existing SELECT policy permits metadata reads. Hash verification uses the
-- server-only service client after authenticating and validating event access.

CREATE OR REPLACE FUNCTION public.guard_event_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Invoker rights are intentional: current_user is the actual database role.
  IF current_user IN ('postgres', 'service_role')
     OR public.is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.featured, false)
       OR NEW.approval_status::text IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Only administrators may approve or feature events' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.featured IS DISTINCT FROM OLD.featured THEN
      RAISE EXCEPTION 'Only administrators may feature events' USING ERRCODE = '42501';
    END IF;
    -- Owners can request review but cannot overturn a moderator decision or
    -- silently reset an approved event. Normal non-moderation edits still work.
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       AND NOT (NEW.approval_status::text = 'submitted'
                AND COALESCE(OLD.approval_status::text, 'not_submitted') IN ('not_submitted', 'rejected')) THEN
      RAISE EXCEPTION 'Only administrators may change approval decisions' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_event_moderation_fields ON public.events;
CREATE TRIGGER guard_event_moderation_fields BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.guard_event_moderation_fields();

-- Security definer ensures the count sees every participant, not just rows
-- visible to the enrolling caller. Lock the parent event before counting so all
-- admissions for the last seat serialize, including trusted server inserts.
CREATE OR REPLACE FUNCTION public.enforce_participant_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap integer; current_count integer;
BEGIN
  IF NEW.role <> 'participant'::public.event_role THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role AND OLD.event_id = NEW.event_id THEN
    RETURN NEW;
  END IF;
  SELECT participant_capacity INTO cap FROM public.events
  WHERE event_id = NEW.event_id FOR UPDATE;
  IF cap IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO current_count FROM public.user_event_roles
  WHERE event_id = NEW.event_id AND role = 'participant'::public.event_role
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF current_count >= cap THEN
    RAISE EXCEPTION 'Event is full. No seats available.' USING ERRCODE = '45000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_participant_capacity() FROM PUBLIC, anon, authenticated;
