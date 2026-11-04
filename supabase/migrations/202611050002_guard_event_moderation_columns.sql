-- Only admins may approve, reject or feature an event, or make an unapproved
-- event public. The events INSERT and UPDATE policies check ownership only, and
-- the browser anon key can write to events directly, so the API routes alone
-- cannot enforce this.
--
-- Non-admins keep these flows:
--   * creating draft or private events, as not_submitted or submitted
--   * moving their event to submitted or not_submitted
--   * switching an already approved event to public (the organizer visibility
--     dropdown offers this)
--
-- service_role and database owners are not guarded: server routes that use the
-- service role (public-submit, the agent API) set these columns themselves.
CREATE OR REPLACE FUNCTION public.enforce_event_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- current_user, unlike a JWT claim, cannot be set by the caller. This function
  -- must stay SECURITY INVOKER for it to name the requesting role.
  IF current_user NOT IN ('authenticated', 'anon')
     OR public.is_admin_user(auth.uid()) IS TRUE THEN
    RETURN NEW;
  END IF;

  -- OLD is a NULL record on INSERT, so each check below covers both operations.
  IF NEW.approval_status::text IN ('approved', 'rejected')
     AND NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Only admins can set approval_status to %', NEW.approval_status
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.featured, false) IS DISTINCT FROM COALESCE(OLD.featured, false) THEN
    RAISE EXCEPTION 'Only admins can change featured'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.visibility::text = 'public'
     AND NEW.visibility IS DISTINCT FROM OLD.visibility
     AND NEW.approval_status::text IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Only admins can make an unapproved event public'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_moderation_columns ON public.events;

CREATE TRIGGER enforce_event_moderation_columns
  BEFORE INSERT OR UPDATE OF approval_status, featured, visibility ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_moderation_columns();
