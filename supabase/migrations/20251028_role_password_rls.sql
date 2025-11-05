ALTER TABLE public.role_passwords ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "role_passwords_select_authenticated" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_insert_organizer" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_update_organizer" ON public.role_passwords;
DROP POLICY IF EXISTS "role_passwords_delete_organizer" ON public.role_passwords;
DROP POLICY IF EXISTS "Authenticated users can view all role passwords for verification" ON public.role_passwords;
DROP POLICY IF EXISTS "Event organizers can create role password requirements" ON public.role_passwords;
DROP POLICY IF EXISTS "Event organizers can modify their event role passwords" ON public.role_passwords;
DROP POLICY IF EXISTS "Event organizers can remove their event role passwords" ON public.role_passwords;

-- Allow all authenticated users to view role passwords
-- This is necessary for password verification during event registration
CREATE POLICY "Authenticated users can view all role passwords for verification"
ON public.role_passwords
FOR SELECT
TO authenticated
USING (true);

-- Allow event organizers to create password requirements for roles in their events
CREATE POLICY "Event organizers can create role password requirements"
ON public.role_passwords
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Allow event organizers to modify password requirements for roles in their events
CREATE POLICY "Event organizers can modify their event role passwords"
ON public.role_passwords
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
)
WITH CHECK (
  public.is_event_organizer(event_id, auth.uid())
);

-- Allow event organizers to remove password requirements from their events
CREATE POLICY "Event organizers can remove their event role passwords"
ON public.role_passwords
FOR DELETE
TO authenticated
USING (
  public.is_event_organizer(event_id, auth.uid())
);