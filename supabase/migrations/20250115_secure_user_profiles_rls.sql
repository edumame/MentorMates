-- Secure user_profiles table by enabling RLS and restricting email access
-- This migration addresses the security flaw where all users could view all emails

-- Enable RLS on user_profiles table (if not already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- Policy: Users can read their own profile (includes email)
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  uid = (SELECT auth.uid())
);

-- Policy: Admins can read all profiles (for admin functionality)
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  uid = (SELECT auth.uid())
)
WITH CHECK (
  uid = (SELECT auth.uid())
);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  uid = (SELECT auth.uid())
);

-- Create a public view that excludes sensitive email information
-- This view can be used for displaying user profiles without exposing emails
CREATE OR REPLACE VIEW public.user_profiles_public AS
SELECT 
  uid,
  display_name,
  created_at,
  pulse,
  links,
  avatar_url,
  bio,
  onboarding_metadata,
  stripe_customer_id
FROM public.user_profiles;

-- Note: The view automatically inherits RLS from the underlying table
-- Users can only see rows they have access to via RLS policies

-- Grant access to the public view
GRANT SELECT ON public.user_profiles_public TO authenticated;
GRANT SELECT ON public.user_profiles_public TO anon;

-- Enable RLS on the view
ALTER VIEW public.user_profiles_public ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view public profile information (without email)
CREATE POLICY "Authenticated users can view public profiles"
ON public.user_profiles_public
FOR SELECT
TO authenticated
USING (true);

-- Policy: Anonymous users can also view public profiles (if needed for public pages)
CREATE POLICY "Anonymous users can view public profiles"
ON public.user_profiles_public
FOR SELECT
TO anon
USING (true);

-- Add comment to document the security improvement
COMMENT ON VIEW public.user_profiles_public IS 
'Public view of user profiles that excludes sensitive email information. Use this view when displaying user profiles to other users. Use the user_profiles table directly only when the current user is viewing their own profile or when admin access is required.';
