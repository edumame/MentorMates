DROP POLICY IF EXISTS "Participant creates own booking" ON public.mentor_bookings;
DROP POLICY IF EXISTS "Update own booking" ON public.mentor_bookings;
REVOKE INSERT, UPDATE ON public.mentor_bookings FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.book_mentor_slot(p_event_id uuid,p_availability_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); slot public.mentor_availability; booking public.mentor_bookings; active_count integer;
BEGIN
 IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_event_roles WHERE event_id=p_event_id AND user_id=actor)
 THEN RAISE EXCEPTION 'Event membership required' USING ERRCODE = '42501'; END IF;
 SELECT * INTO slot FROM public.mentor_availability WHERE id=p_availability_id AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found' USING ERRCODE = 'P0002'; END IF;
 IF slot.mentor_id=actor THEN RAISE EXCEPTION 'Mentors cannot book their own slot' USING ERRCODE = '22023'; END IF;
 IF slot.end_time <= clock_timestamp() THEN RAISE EXCEPTION 'This slot has ended' USING ERRCODE = '23514'; END IF;
 SELECT * INTO booking FROM public.mentor_bookings WHERE availability_id=slot.id AND participant_id=actor;
 IF FOUND AND booking.status='confirmed' THEN RETURN to_jsonb(booking); END IF;
 SELECT count(*) INTO active_count FROM public.mentor_bookings WHERE availability_id=slot.id AND status='confirmed';
 IF active_count >= slot.max_bookings THEN RAISE EXCEPTION 'Slot is fully booked' USING ERRCODE = '23514'; END IF;
 INSERT INTO public.mentor_bookings(availability_id,participant_id,status) VALUES(slot.id,actor,'confirmed')
 ON CONFLICT(availability_id,participant_id) DO UPDATE SET status='confirmed',booked_at=now()
 RETURNING * INTO booking;
 RETURN to_jsonb(booking);
END $$;
REVOKE ALL ON FUNCTION public.book_mentor_slot(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_mentor_slot(uuid,uuid) TO authenticated;
