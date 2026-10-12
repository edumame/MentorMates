-- Migration: Update user_profiles RLS policies
-- Description: Set up RLS to allow admins full access and users access to their own rows only

-- Enable RLS on user_profiles table (if not already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_organizers_and_users_can_select_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_insert_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_and_users_can_delete_own_profile" ON public.user_profiles;

-- SELECT policy: Admins see all, organizers see users in their events, users see own
CREATE POLICY "admins_organizers_and_users_can_select_profiles"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        is_admin_user(auth.uid())
        OR uid = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_event_roles uer
            WHERE uer.user_id = user_profiles.uid
            AND public.is_event_organizer(uer.event_id, auth.uid())
        )
    );

-- INSERT policy: Anyone can insert their own row (for user registration)
CREATE POLICY "admins_and_users_can_insert_own_profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

-- UPDATE policy: Admins update all, users update own
CREATE POLICY "admins_and_users_can_update_own_profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    )
    WITH CHECK (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

-- DELETE policy: Admins delete all, users delete own
CREATE POLICY "admins_and_users_can_delete_own_profile"
    ON public.user_profiles
    FOR DELETE
    TO authenticated
    USING (
        is_admin_user((SELECT auth.uid()))
        OR uid = (SELECT auth.uid())
    );

-- Add comment explaining the RLS setup
COMMENT ON TABLE public.user_profiles IS 'User profile information with RLS: admins have full access, organizers can read profiles of users in their events, users can manage their own rows';
