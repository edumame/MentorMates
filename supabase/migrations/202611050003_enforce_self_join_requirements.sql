-- Self-service joins must meet the same rules as joinParticipantEvent.
--
-- The user_event_roles RLS policies allow any row where user_id = auth.uid(), so
-- a signed-in user could skip payment, approval and the registration
-- questionnaire by writing their own row through PostgREST. This is a trigger
-- rather than a policy change because RLS policies are permissive: a policy with
-- a different name on production would keep the hole open.
--
-- Only a user writing their own row is checked. The service role has no
-- auth.uid(), and organizers and admins may still add or comp anyone.

CREATE OR REPLACE FUNCTION public.enforce_self_join_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  event_paid boolean;
  event_requires_approval boolean;
  has_ticket boolean;
BEGIN
  IF caller IS NULL OR caller <> NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.role NOT IN ('participant'::public.event_role, 'mentor'::public.event_role) THEN
    RETURN NEW;
  END IF;

  -- Rewriting an existing membership is not a join.
  IF TG_OP = 'UPDATE' AND OLD.role = NEW.role AND OLD.event_id = NEW.event_id THEN
    RETURN NEW;
  END IF;

  IF public.is_event_organizer(NEW.event_id, caller) OR public.is_admin_user(caller) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(paid, false), COALESCE(require_participant_approval, false)
  INTO event_paid, event_requires_approval
  FROM public.events
  WHERE event_id = NEW.event_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  has_ticket := EXISTS (
    SELECT 1
    FROM public.event_tickets
    WHERE event_id = NEW.event_id
      AND assigned_to_user_id = NEW.user_id
  );

  IF event_paid AND NOT has_ticket AND NOT EXISTS (
    SELECT 1
    FROM public.user_event_payments
    WHERE event_id = NEW.event_id
      AND user_id = NEW.user_id
      AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Payment required to join this event.' USING ERRCODE = '42501';
  END IF;

  -- app/claim-ticket inserts the role directly, so an assigned ticket also
  -- covers the participant-only checks below.
  IF NEW.role <> 'participant'::public.event_role OR has_ticket THEN
    RETURN NEW;
  END IF;

  IF event_requires_approval AND NOT EXISTS (
    SELECT 1
    FROM public.participant_approval_requests
    WHERE event_id = NEW.event_id
      AND user_id = NEW.user_id
      AND requested_role = 'participant'::public.event_role
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Organizer approval required to join this event.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.event_intake_form_bindings
    WHERE event_id = NEW.event_id
      AND context = 'registration'
      AND is_active
      AND form_version_id IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.intake_form_submissions
    WHERE event_id = NEW.event_id
      AND context = 'registration'
      AND submitter_user_id = NEW.user_id
      AND status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'Registration questionnaire required to join this event.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_self_join_requirements_insert ON public.user_event_roles;
CREATE TRIGGER trg_enforce_self_join_requirements_insert
BEFORE INSERT ON public.user_event_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_self_join_requirements();

DROP TRIGGER IF EXISTS trg_enforce_self_join_requirements_update ON public.user_event_roles;
CREATE TRIGGER trg_enforce_self_join_requirements_update
BEFORE UPDATE OF role, event_id ON public.user_event_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_self_join_requirements();

-- The approval check above is only as strong as this table. The old policy let a
-- user create their own request already marked approved.
DROP POLICY IF EXISTS "Users can create own requests" ON public.participant_approval_requests;
CREATE POLICY "Users can create own requests"
  ON public.participant_approval_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
