-- On paid events an approved participant request now counts as a held seat
-- until the user joins (lib/events/participant-access.ts
-- countReservedParticipantSeats). A full refund must end that reservation, or
-- the seat stays held forever.
--
-- Sorts after the Nov 6/8 migrations: apply_event_checkout
-- (202611060301_checkout_attempts.sql) is what marks a payment refunded.

-- 1. From now on: when a payment becomes refunded, withdraw the user's approved
--    participant request on that (paid) event. Withdrawn requests can be
--    reopened by asking to join again (joinParticipantEvent).
CREATE OR REPLACE FUNCTION public.release_refunded_seat_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
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

-- 2. Backfill: refunds used to leave the request approved, so close the ones
--    already refunded. Approved users with a paid payment and no role are left
--    alone: they may have paid and not finished joining, and organizers can
--    revoke them.
UPDATE public.participant_approval_requests AS request
SET status = 'withdrawn',
    updated_at = NOW()
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
    FROM public.user_event_roles AS existing_role
    WHERE existing_role.event_id = request.event_id
      AND existing_role.user_id = request.user_id
  );
