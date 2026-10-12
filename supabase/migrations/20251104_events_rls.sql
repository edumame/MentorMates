-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS "events_select_private" ON public.events;
DROP POLICY IF EXISTS "events_select_draft_participants" ON public.events;
DROP POLICY IF EXISTS "events_select_draft_owner" ON public.events;
DROP POLICY IF EXISTS "events_select_admin" ON public.events;
DROP POLICY IF EXISTS "events_insert_organizer" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_organizer" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_owner" ON public.events;
DROP POLICY IF EXISTS "events_delete_organizer" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_owner" ON public.events;
DROP POLICY IF EXISTS "Anyone can view public and private events, participants can view draft events, and admins can view all events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events where they are the owner and admins can create any event" ON public.events;
DROP POLICY IF EXISTS "Event owners, organizers, and admins can update events" ON public.events;
DROP POLICY IF EXISTS "Event owners, organizers, and admins can delete events" ON public.events;

-- Policy: Allow viewing events based on visibility
CREATE POLICY "Anyone can view public and private events, participants can view draft events, and admins can view all events"
ON public.events
FOR SELECT
USING (
  -- Public and private events are visible to everyone
  visibility IN ('public'::event_visibility, 'private'::event_visibility)
  OR
  -- Draft events are visible to participants and owners
  (
    visibility = 'draft'::event_visibility
    AND (SELECT auth.uid()) IS NOT NULL
    AND (
      public.user_has_event_role(event_id, (SELECT auth.uid()))
      OR owner_id = (SELECT auth.uid())
    )
  )
  OR
  -- Admins can view all events
  ((SELECT auth.uid()) IS NOT NULL AND public.is_admin_user((SELECT auth.uid())))
);

-- Policy: Allow authenticated users to create events where they are the owner
CREATE POLICY "Authenticated users can create events where they are the owner and admins can create any event"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be the owner of the event they're creating
  owner_id = (SELECT auth.uid())
  OR
  -- Admins can create any event
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Allow event owners, organizers, and admins to update events
CREATE POLICY "Event owners, organizers, and admins can update their events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
  OR
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Allow event owners, organizers, and admins to delete events
CREATE POLICY "Event owners, organizers, and admins can delete their events"
ON public.events
FOR DELETE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR
  public.is_admin_user((SELECT auth.uid()))
);