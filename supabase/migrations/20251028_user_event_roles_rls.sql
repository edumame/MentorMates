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

-- Policy 1: Allow all authenticated users to view all event roles
-- This allows anyone to see who is participating in events
CREATE POLICY "user_event_roles_select_authenticated"
ON public.user_event_roles
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow users to insert their own role assignments
-- Users can join events by creating their own user_event_role entries
CREATE POLICY "user_event_roles_insert_own"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Policy 3: Allow users to update their own role assignments
-- Users can modify their own event participation
CREATE POLICY "user_event_roles_update_own"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Policy 4: Allow users to delete their own role assignments
-- Users can remove themselves from events
CREATE POLICY "user_event_roles_delete_own"
ON public.user_event_roles
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);

-- Policy 5: Allow organizers to insert any user_event_role for their events
-- Organizers can add participants to their events
CREATE POLICY "user_event_roles_insert_organizer"
ON public.user_event_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 6: Allow organizers to update any user_event_role for their events
-- Organizers can modify participant roles in their events
CREATE POLICY "user_event_roles_update_organizer"
ON public.user_event_roles
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
)
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 7: Allow organizers to delete any user_event_role for their events
-- Organizers can remove participants from their events
CREATE POLICY "user_event_roles_delete_organizer"
ON public.user_event_roles
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
);

