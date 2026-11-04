-- On paid events an approved request now counts as a held seat. Refunds used to
-- leave the request approved, so close the ones already refunded or those seats
-- would stay held. Approved users with a paid payment and no role are left alone:
-- they may have paid and not finished joining, and organizers can revoke them.
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
