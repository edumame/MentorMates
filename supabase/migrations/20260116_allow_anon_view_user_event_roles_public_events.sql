-- Migration: Allow anonymous users to view user event roles for public events
-- Date: 2026-01-16
-- Description: Updates RLS policy on user_event_roles table to allow anonymous users
--              to view user event roles for public events. This enables public event
--              pages to display participant information without requiring authentication.

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all event role assignments" ON public.user_event_roles;

-- Policy: Allow anonymous users to view user event roles for public events,
--         and authenticated users to view all event role assignments
CREATE POLICY "Anonymous users can view roles for public events, authenticated users can view all roles"
ON public.user_event_roles
FOR SELECT
USING (
  -- Anonymous users can view roles for public events
  (
    (SELECT auth.uid()) IS NULL
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.event_id = user_event_roles.event_id
      AND events.visibility = 'public'::event_visibility
    )
  )
  OR
  -- Authenticated users can view all event role assignments
  ((SELECT auth.uid()) IS NOT NULL)
);
