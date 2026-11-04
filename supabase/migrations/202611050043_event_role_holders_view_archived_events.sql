-- Let the people attached to an archived event keep reading it.
--
-- The events SELECT policy (20251104_events_rls.sql) has no archived branch, so
-- archiving an event hid it from everyone but global admins. Its organizers
-- lost it from the Hosting tab and could not load it to unarchive it, and its
-- participants lost it from Attended. This mirrors the draft branch of that
-- policy. It is a separate permissive policy, so the existing one is unchanged
-- and archived events stay hidden from anon and from users with no link to them.

DROP POLICY IF EXISTS "Event role holders and owners can view archived events" ON public.events;

CREATE POLICY "Event role holders and owners can view archived events"
ON public.events
FOR SELECT
TO authenticated
USING (
  visibility = 'archived'::event_visibility
  AND (
    public.user_has_event_role(event_id, (SELECT auth.uid()))
    OR owner_id = (SELECT auth.uid())
  )
);
