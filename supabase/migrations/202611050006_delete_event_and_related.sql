-- Apply before deploying the DELETE /api/events/[eventId] route that calls
-- delete_event_and_related. Until then the route returns 500 and deletes nothing.
--
-- Deleting an event spans tables without ON DELETE CASCADE, so it has to be
-- several statements. Running them as one function makes them a single
-- transaction: the event and its data go together, or nothing goes.
--
-- The route authorizes the caller first and then calls this as service_role.
-- It must not run under the caller's RLS: removing the caller's own
-- user_event_roles row would revoke the permission the events delete needs.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_event_and_related(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Holding the row lock blocks new child rows while the cleanup runs.
  PERFORM 1 FROM public.events WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.event_tickets WHERE event_id = p_event_id;

  DELETE FROM public.prize_winners
  WHERE prize_id IN (
    SELECT p.id
    FROM public.prizes p
    JOIN public.event_tracks t ON t.track_id = p.track_id
    WHERE t.event_id = p_event_id
  );

  DELETE FROM public.prizes
  WHERE track_id IN (
    SELECT track_id FROM public.event_tracks WHERE event_id = p_event_id
  );

  DELETE FROM public.event_tracks WHERE event_id = p_event_id;
  DELETE FROM public.platform_engagement WHERE event_id = p_event_id;
  DELETE FROM public.feedback WHERE event_id = p_event_id;
  DELETE FROM public.role_passwords WHERE event_id = p_event_id;
  DELETE FROM public.user_event_roles WHERE event_id = p_event_id;
  DELETE FROM public.events WHERE event_id = p_event_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_and_related(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_and_related(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
