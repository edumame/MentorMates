-- Rejecting an event now moves a public event to draft. Apply the same take-down
-- to events rejected before that change, which are still public by direct link.
-- Private events are left alone: they were only denied a public listing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'approval_status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'visibility'
  ) THEN
    UPDATE public.events
    SET visibility = 'draft'::event_visibility
    WHERE approval_status::text = 'rejected'
      AND visibility::text = 'public';
  END IF;
END $$;
