-- Keep pricing_tiers.current_quantity equal to the tickets sold through paid
-- payments, so max_quantity is enforced. Safe to re-run: the trigger is replaced
-- and the backfill recomputes the count rather than adding to it.
--
-- A trigger on the payment row makes the count atomic with the status change and
-- idempotent: a retried webhook is paid -> paid, which changes nothing.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_pricing_tier_current_quantity()
RETURNS trigger
LANGUAGE plpgsql
-- Checkout upserts the payment row as the buyer, who cannot write pricing_tiers.
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  old_tier_id uuid;
  new_tier_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.payment_status = 'paid' THEN
    old_tier_id := OLD.pricing_id;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.payment_status = 'paid' THEN
    new_tier_id := NEW.pricing_id;
  END IF;

  IF old_tier_id IS NOT DISTINCT FROM new_tier_id THEN
    RETURN NULL;
  END IF;

  UPDATE public.pricing_tiers
  SET current_quantity = GREATEST(COALESCE(current_quantity, 0) - COALESCE(bundle_size, 1), 0)
  WHERE id = old_tier_id;

  UPDATE public.pricing_tiers
  SET current_quantity = COALESCE(current_quantity, 0) + COALESCE(bundle_size, 1)
  WHERE id = new_tier_id;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pricing_tier_current_quantity() FROM PUBLIC, anon, authenticated;

-- Hold off payment writes so none lands between the trigger and the backfill.
LOCK TABLE public.user_event_payments IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS sync_pricing_tier_current_quantity ON public.user_event_payments;
CREATE TRIGGER sync_pricing_tier_current_quantity
  AFTER INSERT OR DELETE OR UPDATE OF payment_status, pricing_id
  ON public.user_event_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pricing_tier_current_quantity();

UPDATE public.pricing_tiers AS tier
SET current_quantity = sold.quantity
FROM (
  SELECT t.id, COALESCE(t.bundle_size, 1) * count(p.id) AS quantity
  FROM public.pricing_tiers AS t
  LEFT JOIN public.user_event_payments AS p
    ON p.pricing_id = t.id AND p.payment_status = 'paid'
  GROUP BY t.id
) AS sold
WHERE sold.id = tier.id
  AND tier.current_quantity IS DISTINCT FROM sold.quantity;

COMMIT;
