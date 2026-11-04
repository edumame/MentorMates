-- The organizer route deleted an event's related rows as separate, unchecked
-- calls outside a transaction, so a failed delete still destroyed data:
--   * Rows the caller's RLS hides, such as another mentor's feedback, survived
--     the cleanup. The events DELETE then failed with 23503 on their FK, after
--     tracks, prizes and roles were already gone.
--   * Removing user_event_roles first took away a non-owner organizer's right
--     to delete the event. The events DELETE matched 0 rows without an error,
--     so the route reported success and left the event gutted.
--
-- Intake forms are not a cause, and their FKs are unchanged. A 23503 from the
-- RESTRICT form_version_id FKs was not reproducible: nested RI actions queue
-- behind the event's own cascades, so bindings, submissions and answers are gone
-- before the RESTRICT checks run.
--
-- One transaction for the organizer delete, so a failure cannot leave a partly
-- wiped event. SECURITY INVOKER keeps every statement under the caller's RLS,
-- exactly as the route's separate calls were. user_event_roles and
-- role_passwords are left to their ON DELETE CASCADE: removing the caller's role
-- first would make a non-owner organizer fail the events DELETE policy.
CREATE OR REPLACE FUNCTION public.delete_event_with_related(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deleted_events INTEGER;
BEGIN
  DELETE FROM public.event_tickets WHERE event_id = p_event_id;

  -- These tables reference events or each other without ON DELETE CASCADE.
  DELETE FROM public.prize_winners
  WHERE prize_id IN (
    SELECT p.id
    FROM public.prizes p
    JOIN public.event_tracks t ON t.track_id = p.track_id
    WHERE t.event_id = p_event_id
  );
  DELETE FROM public.prizes
  WHERE track_id IN (
    SELECT t.track_id FROM public.event_tracks t WHERE t.event_id = p_event_id
  );
  DELETE FROM public.event_tracks WHERE event_id = p_event_id;
  DELETE FROM public.platform_engagement WHERE event_id = p_event_id;
  DELETE FROM public.feedback WHERE event_id = p_event_id;

  DELETE FROM public.events WHERE event_id = p_event_id;
  GET DIAGNOSTICS deleted_events = ROW_COUNT;

  -- RLS hides rows instead of raising, so zero rows must undo the deletes above.
  IF deleted_events = 0 THEN
    RAISE EXCEPTION 'Not allowed to delete event %', p_event_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_with_related(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event_with_related(UUID) TO authenticated;
