-- Enable Row Level Security on role_passwords table
ALTER TABLE public.role_passwords ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "role_passwords_select_authenticated" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_insert_organizer" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_update_organizer" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_delete_organizer" ON public.role_passwords;

-- Policy 1: Allow all authenticated users to view role passwords
-- This is necessary for password verification during event registration
CREATE POLICY "role_passwords_select_authenticated"
ON public.role_passwords
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow organizers to insert role passwords for their events
-- Only event organizers can create password requirements for roles
CREATE POLICY "role_passwords_insert_organizer"
ON public.role_passwords
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 3: Allow organizers to update role passwords for their events
-- Only event organizers can modify password requirements
CREATE POLICY "role_passwords_update_organizer"
ON public.role_passwords
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
)
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Policy 4: Allow organizers to delete role passwords for their events
-- Only event organizers can remove password requirements
CREATE POLICY "role_passwords_delete_organizer"
ON public.role_passwords
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
);

