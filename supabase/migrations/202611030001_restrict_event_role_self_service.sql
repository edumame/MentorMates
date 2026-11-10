-- Stops users from granting themselves privileged event roles.
--
-- Before this migration a user could insert or update their own
-- user_event_roles row with any role, including organizer, using only the
-- public anon key. Privileged roles are now written by server routes that have
-- verified a password or a signed invitation.
--
-- Deploy the matching application code first: it writes these roles with the
-- service client, so it works under both the old and the new policies.

DROP POLICY IF EXISTS "Users, organizers, and admins can assign roles to events" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users, organizers, and admins can update roles" ON public.user_event_roles;

CREATE POLICY "Users, organizers, and admins can assign roles to events"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = (SELECT auth.uid()) AND role = 'participant')
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Users can no longer update their own row. Leaving an event still works through
-- the unchanged DELETE policy.
CREATE POLICY "Organizers and admins can update roles"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Users could also insert their own approval request as already approved.
DROP POLICY IF EXISTS "Users can create own requests" ON public.participant_approval_requests;

CREATE POLICY "Users can create own requests"
ON public.participant_approval_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');
