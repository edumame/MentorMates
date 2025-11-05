-- Helper function to check if a user is an organizer for an event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_event_roles 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND role = 'organizer'
  );
END;
$$;

-- Helper function to check if a user has any role in an event
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.user_has_event_role(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_event_roles 
    WHERE event_id = p_event_id 
      AND user_id = p_user_id
  );
END;
$$;

-- Enable RLS on user_event_roles table
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "user_event_roles_select_authenticated" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_insert_own" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_update_own" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_delete_own" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_insert_organizer" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_update_organizer" ON public.user_event_roles;
DROP POLICY IF EXISTS "user_event_roles_delete_organizer" ON public.user_event_roles;
DROP POLICY IF EXISTS "Authenticated users can view all event role assignments" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users and event organizers can assign roles to events" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can update their own roles and organizers can update any role" ON public.user_event_roles;
DROP POLICY IF EXISTS "Users can remove their own roles and organizers can remove any role" ON public.user_event_roles;

-- Policy 1: SELECT - Allow all authenticated users to view event role assignments
-- Anyone can see who is participating in events and what their roles are
CREATE POLICY "Authenticated users can view all event role assignments"
ON public.user_event_roles
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: INSERT - Allow users to assign themselves to events and organizers to assign anyone
-- Users can join events themselves, and event organizers can add any participant
CREATE POLICY "Users and event organizers can assign roles to events"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
);

-- Policy 3: UPDATE - Allow users to update their own role and organizers to update any role
-- Users can modify their own event participation, and organizers can modify any participant's role
CREATE POLICY "Users can update their own roles and organizers can update any role"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
);

-- Policy 4: DELETE - Allow users to remove themselves and organizers to remove anyone
-- Users can leave events, and event organizers can remove any participant
CREATE POLICY "Users can remove their own roles and organizers can remove any role"
ON public.user_event_roles
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
);

