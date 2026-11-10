-- Keep the existing user/event entitlement row; preserve every checkout independently.
CREATE TABLE public.payment_checkout_attempts (
  session_id text PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.user_event_payments(id) ON DELETE CASCADE,
  pricing_id uuid REFERENCES public.pricing_tiers(id),
  bundle_size integer NOT NULL CHECK (bundle_size > 0),
  payment_intent_id text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','paid','canceled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_checkout_attempts FROM anon, authenticated;
CREATE INDEX payment_checkout_attempts_intent_idx ON public.payment_checkout_attempts(payment_intent_id);
ALTER TABLE public.event_tickets ADD COLUMN checkout_session_id text REFERENCES public.payment_checkout_attempts(session_id);
-- Adopt historical sessions without reissuing tickets. No existing rows are deleted.
INSERT INTO public.payment_checkout_attempts(session_id,payment_id,pricing_id,bundle_size,payment_intent_id,status)
SELECT p.stripe_session_id,p.id,p.pricing_id,GREATEST(COALESCE(t.bundle_size,1),1),p.stripe_payment_intent_id,p.payment_status::text
FROM public.user_event_payments p LEFT JOIN public.pricing_tiers t ON t.id=p.pricing_id
WHERE p.stripe_session_id IS NOT NULL;
UPDATE public.event_tickets t SET checkout_session_id=p.stripe_session_id
FROM public.user_event_payments p WHERE t.payment_id=p.id AND p.stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_event_checkout(p_user_id uuid,p_event_id uuid,p_pricing_id uuid,p_customer text,p_session text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment_id_value uuid; quantity integer;
BEGIN
  SELECT bundle_size INTO quantity FROM public.pricing_tiers WHERE id=p_pricing_id AND event_id=p_event_id AND is_active=true;
  IF quantity IS NULL OR quantity < 1 THEN RAISE EXCEPTION 'Invalid pricing tier'; END IF;
  INSERT INTO public.user_event_payments(user_id,event_id,stripe_customer_id,stripe_session_id,pricing_id,payment_status)
    VALUES(p_user_id,p_event_id,p_customer,p_session,p_pricing_id,'processing')
    ON CONFLICT(user_id,event_id) DO UPDATE SET updated_at=now()
    RETURNING id INTO payment_id_value;
  INSERT INTO public.payment_checkout_attempts(session_id,payment_id,pricing_id,bundle_size)
    VALUES(p_session,payment_id_value,p_pricing_id,quantity);
  RETURN payment_id_value;
END $$;

CREATE OR REPLACE FUNCTION public.apply_event_checkout(p_session text,p_intent text,p_status text,p_amount integer DEFAULT NULL,p_currency text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE attempt public.payment_checkout_attempts; payment public.user_event_payments; ticket_id uuid;
BEGIN
  IF p_status NOT IN ('paid','canceled','refunded') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  -- Serialize all checkouts for one user/event, including refund-versus-completion.
  SELECT p.* INTO payment FROM public.user_event_payments p JOIN public.payment_checkout_attempts a ON a.payment_id=p.id
    WHERE (p_session IS NOT NULL AND a.session_id=p_session) OR (p_session IS NULL AND a.payment_intent_id=p_intent)
    LIMIT 1 FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout mapping not found'; END IF;
  SELECT * INTO attempt FROM public.payment_checkout_attempts WHERE payment_id=payment.id AND
    ((p_session IS NOT NULL AND session_id=p_session) OR (p_session IS NULL AND payment_intent_id=p_intent)) FOR UPDATE;
  IF attempt.status=p_status OR attempt.status='refunded' THEN RETURN 'duplicate'; END IF;
  IF p_status='canceled' AND attempt.status='paid' THEN RETURN 'ignored'; END IF;
  UPDATE public.payment_checkout_attempts SET status=p_status,payment_intent_id=COALESCE(p_intent,payment_intent_id) WHERE session_id=attempt.session_id;
  IF p_status='paid' THEN
    INSERT INTO public.event_tickets(event_id,payment_id,purchased_by_user_id,ticket_status,checkout_session_id)
      SELECT payment.event_id,payment.id,payment.user_id,'unassigned',attempt.session_id FROM generate_series(1,attempt.bundle_size);
    IF NOT EXISTS(SELECT 1 FROM public.event_tickets WHERE event_id=payment.event_id AND assigned_to_user_id=payment.user_id) THEN
      SELECT id INTO ticket_id FROM public.event_tickets WHERE checkout_session_id=attempt.session_id ORDER BY id LIMIT 1;
      UPDATE public.event_tickets SET assigned_to_user_id=payment.user_id,ticket_status='assigned',assigned_at=now() WHERE id=ticket_id;
    END IF;
    UPDATE public.user_event_payments SET payment_status='paid',stripe_session_id=attempt.session_id,
      stripe_payment_intent_id=p_intent,pricing_id=attempt.pricing_id,amount_paid=p_amount,currency=COALESCE(p_currency,currency) WHERE id=payment.id;
  ELSIF p_status='refunded' THEN
    DELETE FROM public.event_tickets WHERE checkout_session_id=attempt.session_id;
    IF NOT EXISTS(SELECT 1 FROM public.payment_checkout_attempts WHERE payment_id=payment.id AND status='paid') THEN
      UPDATE public.user_event_payments SET payment_status='refunded' WHERE id=payment.id;
      -- Refund only purchaser participation; never remove judge/mentor/organizer rights.
      IF NOT EXISTS(SELECT 1 FROM public.event_tickets WHERE event_id=payment.event_id AND assigned_to_user_id=payment.user_id) THEN
        DELETE FROM public.user_event_roles WHERE event_id=payment.event_id AND user_id=payment.user_id AND role='participant';
      END IF;
    END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.payment_checkout_attempts WHERE payment_id=payment.id AND status='paid') THEN
    UPDATE public.user_event_payments SET payment_status='canceled' WHERE id=payment.id;
  END IF;
  RETURN 'applied';
END $$;
REVOKE ALL ON FUNCTION public.register_event_checkout(uuid,uuid,uuid,text,text),public.apply_event_checkout(text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_event_checkout(uuid,uuid,uuid,text,text),public.apply_event_checkout(text,text,text,integer,text) TO service_role;
