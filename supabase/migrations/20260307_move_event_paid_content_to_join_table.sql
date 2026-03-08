-- Move paid content out of events into a dedicated table with stricter RLS.

-- Helper function: checks whether a user has joined an event through any supported signal.
CREATE OR REPLACE FUNCTION public.user_has_joined_event(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = p_event_id
      AND uer.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.event_tickets et
    WHERE et.event_id = p_event_id
      AND et.assigned_to_user_id = p_user_id
      AND et.ticket_status IN ('assigned', 'used')
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_event_payments uep
    WHERE uep.event_id = p_event_id
      AND uep.user_id = p_user_id
      AND uep.payment_status = 'paid'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_paid_content (
  event_id uuid PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  paywall_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_paid_content IS 'Exclusive event content that should only be visible to users who have joined the event.';
COMMENT ON COLUMN public.event_paid_content.paywall_content IS 'Markdown content visible only to users who have joined the event.';

CREATE TRIGGER update_event_paid_content_updated_at
  BEFORE UPDATE ON public.event_paid_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from legacy events.paywall_content.
INSERT INTO public.event_paid_content (event_id, paywall_content, created_at, updated_at)
SELECT
  e.event_id,
  e.paywall_content,
  COALESCE(e.updated_at, e.created_at, now()),
  COALESCE(e.updated_at, e.created_at, now())
FROM public.events e
WHERE e.paywall_content IS NOT NULL
  AND btrim(e.paywall_content) <> ''
ON CONFLICT (event_id) DO UPDATE
SET
  paywall_content = EXCLUDED.paywall_content,
  updated_at = now();

-- Remove legacy column after backfill.
ALTER TABLE public.events
DROP COLUMN IF EXISTS paywall_content;

ALTER TABLE public.event_paid_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users who joined event can view paid content" ON public.event_paid_content;
DROP POLICY IF EXISTS "Organizers can insert paid content" ON public.event_paid_content;
DROP POLICY IF EXISTS "Organizers can update paid content" ON public.event_paid_content;
DROP POLICY IF EXISTS "Organizers can delete paid content" ON public.event_paid_content;

CREATE POLICY "Users who joined event can view paid content"
ON public.event_paid_content
FOR SELECT
TO authenticated
USING (
  public.user_has_joined_event(event_id, (SELECT auth.uid()))
);

CREATE POLICY "Organizers can insert paid content"
ON public.event_paid_content
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.event_id = event_paid_content.event_id
      AND (
        e.owner_id = (SELECT auth.uid())
        OR public.is_event_organizer(event_paid_content.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Organizers can update paid content"
ON public.event_paid_content
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.event_id = event_paid_content.event_id
      AND (
        e.owner_id = (SELECT auth.uid())
        OR public.is_event_organizer(event_paid_content.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.event_id = event_paid_content.event_id
      AND (
        e.owner_id = (SELECT auth.uid())
        OR public.is_event_organizer(event_paid_content.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Organizers can delete paid content"
ON public.event_paid_content
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.event_id = event_paid_content.event_id
      AND (
        e.owner_id = (SELECT auth.uid())
        OR public.is_event_organizer(event_paid_content.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);
