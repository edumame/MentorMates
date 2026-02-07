-- Add lead_user_id column to projects table to enable querying by user_id
-- This addresses the issue where projects are indexed by email, but RLS prevents
-- accessing other users' emails

-- Add lead_user_id column (nullable, will be backfilled)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS lead_user_id UUID REFERENCES public.user_profiles(uid) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_lead_user_id ON public.projects(lead_user_id);

-- Backfill lead_user_id from existing lead_email data
-- Match emails from user_profiles table
UPDATE public.projects p
SET lead_user_id = up.uid
FROM public.user_profiles up
WHERE p.lead_email = up.email
  AND p.lead_user_id IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.projects.lead_user_id IS 
'User ID of the project lead. Added to enable querying projects by user_id when email is not accessible due to RLS. Should be kept in sync with lead_email.';

-- Create a function to automatically sync lead_user_id when lead_email is updated
-- This ensures new projects and updates maintain consistency
CREATE OR REPLACE FUNCTION sync_lead_user_id_from_email()
RETURNS TRIGGER AS $$
BEGIN
  -- If lead_email is set and lead_user_id is null or different, update it
  IF NEW.lead_email IS NOT NULL THEN
    SELECT uid INTO NEW.lead_user_id
    FROM public.user_profiles
    WHERE email = NEW.lead_email
    LIMIT 1;
  ELSE
    -- If lead_email is cleared, clear lead_user_id too
    NEW.lead_user_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync lead_user_id when lead_email changes
DROP TRIGGER IF EXISTS sync_lead_user_id_trigger ON public.projects;
CREATE TRIGGER sync_lead_user_id_trigger
  BEFORE INSERT OR UPDATE OF lead_email ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_user_id_from_email();

-- Note: For teammates, we'll continue using the email array for now
-- A future migration could create a project_teammates junction table if needed
-- For now, teammates can still be queried by email when the user is viewing their own profile
