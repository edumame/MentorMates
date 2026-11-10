-- Durable retryable leases replace per-process, eagerly-completed deduplication.
CREATE TABLE public.chat_webhook_receipts (
  message_id text PRIMARY KEY,
  token uuid NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  leased_until timestamptz NOT NULL
);
ALTER TABLE public.chat_webhook_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_webhook_receipts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_chat_webhook(p_message_id text, p_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE receipt public.chat_webhook_receipts;
BEGIN
  INSERT INTO public.chat_webhook_receipts VALUES (p_message_id, p_token, false, now() + interval '5 minutes')
    ON CONFLICT DO NOTHING;
  SELECT * INTO receipt FROM public.chat_webhook_receipts WHERE message_id=p_message_id FOR UPDATE;
  IF receipt.completed THEN RETURN 'completed'; END IF;
  IF receipt.token <> p_token AND receipt.leased_until > now() THEN RETURN 'busy'; END IF;
  UPDATE public.chat_webhook_receipts SET token=p_token, leased_until=now()+interval '5 minutes' WHERE message_id=p_message_id;
  RETURN 'claimed';
END $$;
CREATE OR REPLACE FUNCTION public.finish_chat_webhook(p_message_id text, p_token uuid, p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_completed THEN
    UPDATE public.chat_webhook_receipts SET completed=true WHERE message_id=p_message_id AND token=p_token;
  ELSE
    DELETE FROM public.chat_webhook_receipts WHERE message_id=p_message_id AND token=p_token AND NOT completed;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_chat_webhook(text,uuid), public.finish_chat_webhook(text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chat_webhook(text,uuid), public.finish_chat_webhook(text,uuid,boolean) TO service_role;
