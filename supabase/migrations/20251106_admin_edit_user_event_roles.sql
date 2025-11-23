-- Migration: Allow admins to edit user event roles
-- Date: 2025-11-06
-- Description: Updates RLS policies on user_event_roles table to allow platform admins
--              to insert, update, and delete user event roles for any event.
--              Admins can manage event participation and roles across all events.

-- Drop existing policies that will be replaced
DROP POLICY IF EXISTS "Users and event organizers can assign roles to events" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can update their own roles and organizers can update any role" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can remove their own roles and organizers can remove any role" ON public.user_event_roles;

-- Policy 1: INSERT - Allow users to assign themselves, organizers to assign anyone, and admins to assign anyone
-- Users can join events themselves, event organizers can add any participant to their events,
-- and platform admins can add any participant to any event
CREATE POLICY "Users, organizers, and admins can assign roles to events"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Policy 2: UPDATE - Allow users to update their own role, organizers to update any role in their events, and admins to update any role
-- Users can modify their own event participation, event organizers can modify any participant's role in their events,
-- and platform admins can modify any participant's role in any event
CREATE POLICY "Users, organizers, and admins can update roles"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- Policy 3: DELETE - Allow users to remove themselves, organizers to remove anyone from their events, and admins to remove anyone
-- Users can leave events, event organizers can remove any participant from their events,
-- and platform admins can remove any participant from any event
CREATE POLICY "Users, organizers, and admins can remove roles"
ON public.user_event_roles
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

