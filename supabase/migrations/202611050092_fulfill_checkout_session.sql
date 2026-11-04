-- Apply before deploying the /api/stripe route that calls fulfill_checkout_session.
-- Until then checkout.session.completed deliveries fail and Stripe retries them.
--
-- Stripe delivers webhooks at least once. Locking the payment row and doing the
-- paid transition, ticket insert and buyer assignment in one transaction means a
-- redelivery, concurrent or not, cannot issue a second bundle, and a failure
-- leaves nothing behind, so the retry still fulfills the payment in full. Once
-- this commits a redelivery changes nothing, so a buyer who gave their ticket
-- away is not handed another one.
BEGIN;
CREATE OR REPLACE FUNCTION public.fulfill_checkout_session(
  p_stripe_customer_id text,
  p_stripe_session_id text,
  p_amount_paid integer,
  p_stripe_payment_intent_id text
)
RETURNS TABLE (id uuid, event_id uuid, user_id uuid, tickets_issued boolean)
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
#variable_conflict use_column
DECLARE
  v_payment public.user_event_payments%ROWTYPE;
  v_bundle_size integer;
  v_buyer_needs_ticket boolean;
BEGIN
  SELECT uep.* INTO v_payment
  FROM public.user_event_payments AS uep
  WHERE uep.stripe_customer_id = p_stripe_customer_id
    AND uep.stripe_session_id = p_stripe_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- A paid row with no tickets is still fulfilled: the previous webhook code
  -- marked the row paid before inserting, so a retry may be owed its tickets.
  IF v_payment.payment_status = 'refunded'
    OR (
      v_payment.payment_status = 'paid'
      AND EXISTS (
        SELECT 1 FROM public.event_tickets AS ticket
        WHERE ticket.payment_id = v_payment.id
      )
    )
  THEN
    RETURN QUERY SELECT v_payment.id, v_payment.event_id, v_payment.user_id, false;
    RETURN;
  END IF;

  SELECT tier.bundle_size INTO v_bundle_size
  FROM public.pricing_tiers AS tier
  WHERE tier.id = v_payment.pricing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing tier not found for payment %', v_payment.id;
  END IF;

  UPDATE public.user_event_payments AS uep
  SET payment_status = 'paid',
      amount_paid = p_amount_paid,
      stripe_payment_intent_id = p_stripe_payment_intent_id
  WHERE uep.id = v_payment.id;

  v_buyer_needs_ticket := NOT EXISTS (
    SELECT 1 FROM public.event_tickets AS ticket
    WHERE ticket.event_id = v_payment.event_id
      AND ticket.assigned_to_user_id = v_payment.user_id
  );

  -- The first ticket of the bundle is the buyer's own seat.
  INSERT INTO public.event_tickets (
    event_id, payment_id, purchased_by_user_id, assigned_to_user_id, ticket_status
  )
  SELECT
    v_payment.event_id,
    v_payment.id,
    v_payment.user_id,
    CASE WHEN seat = 1 AND v_buyer_needs_ticket THEN v_payment.user_id END,
    CASE
      WHEN seat = 1 AND v_buyer_needs_ticket THEN 'assigned'::public.ticket_status_enum
      ELSE 'unassigned'::public.ticket_status_enum
    END
  FROM generate_series(1, v_bundle_size) AS seat;

  RETURN QUERY SELECT v_payment.id, v_payment.event_id, v_payment.user_id, true;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_checkout_session(text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout_session(text, text, integer, text) TO service_role;
COMMENT ON FUNCTION public.fulfill_checkout_session(text, text, integer, text) IS
  'Service-only, idempotent checkout fulfillment: marks the payment paid, issues its tickets and assigns one to the buyer, exactly once per Stripe session. tickets_issued is false when an earlier delivery already did, or the payment was refunded.';
COMMIT;
