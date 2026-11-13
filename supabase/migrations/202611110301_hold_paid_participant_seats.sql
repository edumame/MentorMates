-- On paid events an approved participant request counts as a held seat until
-- the user joins (lib/events/participant-access.ts countReservedParticipantSeats):
-- approval creates no role there, the role is only created after payment.
--
-- This migration makes the database agree with that rule:
--   1. approving a paid participant request takes the event lock and refuses
--      (45000, like enforce_participant_capacity) when every seat is held, so
--      two organizers approving at the same moment cannot over-fill the event;
--   2. a full refund ends the hold;
--   3. refunds made before this migration stop holding seats.
--
-- Held seats do not expire: an approved user who never pays keeps the seat
-- until an organizer revokes them or they leave.
--
-- Refunds follow apply_event_checkout (202611060301_checkout_attempts.sql):
-- each checkout is a payment_checkout_attempts row, and user_event_payments only
-- becomes 'refunded' once no attempt is still 'paid'. Refunding one of several
-- paid checkouts, or a partial Stripe refund (the webhook ignores those), leaves
-- the payment 'paid', so the seat stays held.

-- 1. Seats held on an event, not counting p_exclude_user_id: every participant
--    role, plus on paid events every approved participant request whose user
--    has no role on the event yet. Same rule as countReservedParticipantSeats.
CREATE OR REPLACE FUNCTION public.held_participant_seats(
  p_event_id uuid,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer
  FROM (
    SELECT role_row.user_id
    FROM public.user_event_roles AS role_row
    WHERE role_row.event_id = p_event_id
      AND role_row.role = 'participant'::public.event_role
    UNION
    SELECT request.user_id
    FROM public.participant_approval_requests AS request
    JOIN public.events AS event ON event.event_id = request.event_id
    WHERE request.event_id = p_event_id
      AND event.paid = TRUE
      AND request.requested_role = 'participant'::public.event_role
      AND request.status = 'approved'::public.participant_request_status
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_event_roles AS any_role
        WHERE any_role.event_id = request.event_id
          AND any_role.user_id = request.user_id
      )
  ) AS held
  WHERE p_exclude_user_id IS NULL OR held.user_id <> p_exclude_user_id;
$$;
REVOKE ALL ON FUNCTION public.held_participant_seats(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.held_participant_seats(uuid, uuid) TO service_role;

-- 2. Approving a paid participant request takes a seat, so check capacity under
--    the same event row lock enforce_participant_capacity uses. Free events are
--    left to enforce_participant_capacity, because approval there inserts the
--    participant role straight away.
CREATE OR REPLACE FUNCTION public.enforce_paid_participant_seat_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cap integer;
  is_paid boolean;
BEGIN
  IF NEW.requested_role <> 'participant'::public.event_role
     OR NEW.status <> 'approved'::public.participant_request_status
     OR (TG_OP = 'UPDATE'
         AND OLD.status = 'approved'::public.participant_request_status
         AND OLD.event_id = NEW.event_id
         AND OLD.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT participant_capacity, paid INTO cap, is_paid
  FROM public.events
  WHERE event_id = NEW.event_id
  FOR UPDATE;

  IF cap IS NULL OR is_paid IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF public.held_participant_seats(NEW.event_id, NEW.user_id) >= cap THEN
    RAISE EXCEPTION 'Event is full. No seats available.' USING ERRCODE = '45000';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_paid_participant_seat_hold() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_paid_participant_seat_hold ON public.participant_approval_requests;
CREATE TRIGGER enforce_paid_participant_seat_hold
  BEFORE INSERT OR UPDATE OF status, event_id, user_id, requested_role
  ON public.participant_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_participant_seat_hold();

-- 3. When a payment becomes refunded (apply_event_checkout, once no checkout
--    attempt is still paid), withdraw the user's approved participant request
--    on that paid event. Like apply_event_checkout's role removal, a user who
--    still holds a ticket someone else assigned them keeps their place.
--    Withdrawn requests can be reopened by asking to join again
--    (joinParticipantEvent).
CREATE OR REPLACE FUNCTION public.release_refunded_seat_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded'
     AND NOT EXISTS (
       SELECT 1
       FROM public.event_tickets AS ticket
       WHERE ticket.event_id = NEW.event_id
         AND ticket.assigned_to_user_id = NEW.user_id
     ) THEN
    UPDATE public.participant_approval_requests AS request
       SET status = 'withdrawn',
           updated_at = now()
      FROM public.events AS event
     WHERE event.event_id = NEW.event_id
       AND event.paid = TRUE
       AND request.event_id = NEW.event_id
       AND request.user_id = NEW.user_id
       AND request.requested_role = 'participant'
       AND request.status = 'approved';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_refunded_seat_reservation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS release_refunded_seat_reservation ON public.user_event_payments;
CREATE TRIGGER release_refunded_seat_reservation
  AFTER UPDATE OF payment_status ON public.user_event_payments
  FOR EACH ROW EXECUTE FUNCTION public.release_refunded_seat_reservation();

-- 4. Backfill: refunds used to leave the request approved, so close the ones
--    already fully refunded (no checkout attempt still paid, no assigned
--    ticket, no role). Approved users with a paid payment and no role are left
--    alone: they may have paid and not finished joining, and organizers can
--    revoke them.
UPDATE public.participant_approval_requests AS request
SET status = 'withdrawn',
    updated_at = now()
FROM public.events AS event,
     public.user_event_payments AS payment
WHERE event.event_id = request.event_id
  AND event.paid = TRUE
  AND payment.event_id = request.event_id
  AND payment.user_id = request.user_id
  AND payment.payment_status = 'refunded'
  AND request.status = 'approved'
  AND request.requested_role = 'participant'
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_checkout_attempts AS attempt
    WHERE attempt.payment_id = payment.id
      AND attempt.status = 'paid'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_tickets AS ticket
    WHERE ticket.event_id = request.event_id
      AND ticket.assigned_to_user_id = request.user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_event_roles AS existing_role
    WHERE existing_role.event_id = request.event_id
      AND existing_role.user_id = request.user_id
  );
