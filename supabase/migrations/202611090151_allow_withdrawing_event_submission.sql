-- audit-151: archiving an event, or setting it back to Draft, withdraws a
-- pending approval request (approval_status submitted -> not_submitted), so a
-- hidden event leaves the admin Submitted queue and cannot be published by a
-- stale approval.
--
-- The moderation guard from 202611060101 only let non-admins move
-- not_submitted/rejected -> submitted, so the organizer's archive request was
-- rejected with 42501. Withdrawing their own pending request does not overturn
-- a moderator decision, so allow submitted -> not_submitted as well. Approved
-- and rejected decisions still cannot be changed by non-admins.
--
-- Must run after 202611060101. Idempotent.

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
    -- Owners can request review, or withdraw a pending request, but cannot
    -- overturn a moderator decision or silently reset an approved event.
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       AND NOT (NEW.approval_status::text = 'submitted'
                AND COALESCE(OLD.approval_status::text, 'not_submitted') IN ('not_submitted', 'rejected'))
       AND NOT (NEW.approval_status::text = 'not_submitted'
                AND OLD.approval_status::text = 'submitted') THEN
      RAISE EXCEPTION 'Only administrators may change approval decisions' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
