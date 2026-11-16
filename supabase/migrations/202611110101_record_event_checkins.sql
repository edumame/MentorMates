-- Apply before deploying the /api/checkin route that calls record_event_checkin.
-- Free-event participants, mentors and judges have no event_tickets row, so the
-- check-in record lives in its own table; a held ticket is also marked 'used'.
BEGIN;
CREATE TABLE IF NOT EXISTS public.event_checkins (
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  checked_in_by uuid REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_checkins_user_id ON public.event_checkins(user_id);

-- Written only through the route after it has verified the caller is staff, so
-- attendees cannot check themselves in with their own session.
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_checkins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checkins TO service_role;

CREATE OR REPLACE FUNCTION public.record_event_checkin(
  p_event_id uuid,
  p_user_id uuid,
  p_checked_in_by uuid
)
RETURNS TABLE (outcome text, recorded_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  first_checkin_at timestamptz;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL OR p_checked_in_by IS NULL THEN
    RAISE EXCEPTION 'Event, attendee and staff IDs are required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_event_roles AS registration
    WHERE registration.event_id = p_event_id AND registration.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'not_registered'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- The primary key makes this atomic: of two simultaneous scans, one inserts
  -- and the other waits, conflicts and reports the winner's timestamp.
  INSERT INTO public.event_checkins AS checkin (event_id, user_id, checked_in_by)
  VALUES (p_event_id, p_user_id, p_checked_in_by)
  ON CONFLICT (event_id, user_id) DO NOTHING
  RETURNING checkin.checked_in_at INTO first_checkin_at;

  IF first_checkin_at IS NULL THEN
    SELECT checkin.checked_in_at INTO first_checkin_at
    FROM public.event_checkins AS checkin
    WHERE checkin.event_id = p_event_id AND checkin.user_id = p_user_id;

    RETURN QUERY SELECT 'already_checked_in'::text, first_checkin_at;
    RETURN;
  END IF;

  -- One entry uses one ticket, even if the attendee somehow holds several.
  UPDATE public.event_tickets AS ticket
  SET ticket_status = 'used', updated_at = now()
  WHERE ticket.id = (
    SELECT held.id FROM public.event_tickets AS held
    WHERE held.event_id = p_event_id
      AND held.assigned_to_user_id = p_user_id
      AND held.ticket_status = 'assigned'
    ORDER BY held.created_at, held.id
    LIMIT 1
    FOR UPDATE
  );

  RETURN QUERY SELECT 'checked_in'::text, first_checkin_at;
END;
$$;
REVOKE ALL ON FUNCTION public.record_event_checkin(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_checkin(uuid, uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.record_event_checkin(uuid, uuid, uuid) IS
  'Service-only: the caller must have verified p_checked_in_by is event staff. Records the first scan, marks one held ticket used, and reports repeats.';
COMMIT;
