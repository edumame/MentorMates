-- Depends on immutable checkout attempts (202611060301). Ticket claims are
-- explicit paid invitations, not an unrestricted participant self-insert.
CREATE OR REPLACE FUNCTION public.claim_event_ticket(p_ticket_id uuid, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.event_tickets; p public.user_event_payments; email text; payment_state text;
BEGIN
  SELECT lower(trim(u.email)) INTO email FROM auth.users u WHERE u.id = p_user_id;
  IF email IS NULL THEN RAISE EXCEPTION 'Verified account required' USING ERRCODE = '42501'; END IF;
  -- Same lock order as fulfillment/refund: payment before ticket/attempt.
  SELECT payment.* INTO p FROM public.user_event_payments payment
  JOIN public.event_tickets ticket ON ticket.payment_id = payment.id
  WHERE ticket.id = p_ticket_id FOR UPDATE OF payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO t FROM public.event_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE = 'P0002'; END IF;
  IF t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Ticket unavailable' USING ERRCODE = '42501';
  END IF;
  IF t.assigned_to_user_id IS NULL AND lower(trim(t.assigned_to_email)) IS DISTINCT FROM email THEN
    RAISE EXCEPTION 'Ticket is assigned to another account' USING ERRCODE = '42501';
  END IF;
  IF p.event_id IS DISTINCT FROM t.event_id OR p.user_id IS DISTINCT FROM t.purchased_by_user_id THEN
    RAISE EXCEPTION 'Invalid ticket payment' USING ERRCODE = '42501';
  END IF;
  IF t.checkout_session_id IS NOT NULL THEN
    SELECT status INTO payment_state FROM public.payment_checkout_attempts
    WHERE session_id = t.checkout_session_id AND payment_id = p.id FOR UPDATE;
  ELSE
    payment_state := p.payment_status::text;
  END IF;
  IF payment_state IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Ticket payment is not valid' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(t.ticket_status::text, '') NOT IN ('unassigned', 'assigned') THEN
    RAISE EXCEPTION 'Ticket cannot be claimed' USING ERRCODE = '42501';
  END IF;
  -- Preserve an existing organizer/judge/mentor role. Capacity enforcement is
  -- shared with every participant insertion and failure rolls back assignment.
  IF NOT EXISTS(SELECT 1 FROM public.user_event_roles WHERE event_id=t.event_id AND user_id=p_user_id) THEN
    INSERT INTO public.user_event_roles(event_id,user_id,role) VALUES(t.event_id,p_user_id,'participant')
    ON CONFLICT(user_id,event_id) DO NOTHING;
  END IF;
  UPDATE public.event_tickets SET assigned_to_user_id=p_user_id,ticket_status='assigned',
    assigned_at=COALESCE(assigned_at,now()),updated_at=now() WHERE id=t.id;
  RETURN t.event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_event_ticket(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_ticket(uuid,uuid) TO service_role;

-- Ticket identity and payment linkage are server-owned. The browser purchaser
-- may send an invitation only while the ticket is still unclaimed.
REVOKE UPDATE ON public.event_tickets FROM PUBLIC, anon, authenticated;
GRANT UPDATE (assigned_to_email, ticket_status, assigned_at, updated_at) ON public.event_tickets TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_ticket_invitation_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN RETURN NEW; END IF;
  IF OLD.purchased_by_user_id IS DISTINCT FROM auth.uid()
     OR OLD.assigned_to_user_id IS NOT NULL
     OR COALESCE(OLD.ticket_status::text, '') NOT IN ('unassigned', 'assigned')
     OR NEW.ticket_status::text IS DISTINCT FROM 'assigned'
     OR NEW.assigned_to_email IS NULL OR trim(NEW.assigned_to_email) = ''
     OR NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id
     OR NEW.purchased_by_user_id IS DISTINCT FROM OLD.purchased_by_user_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id THEN
    RAISE EXCEPTION 'Only an unclaimed ticket invitation may be edited' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_ticket_invitation_update ON public.event_tickets;
CREATE TRIGGER guard_ticket_invitation_update BEFORE UPDATE ON public.event_tickets
FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_invitation_update();
