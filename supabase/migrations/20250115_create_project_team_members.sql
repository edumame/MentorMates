-- Create project_team_members junction table
-- This table allows inviting participants by email before they sign up,
-- and automatically links them when they create an account

CREATE TABLE IF NOT EXISTS public.project_team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
  role TEXT DEFAULT 'teammate' CHECK (role IN ('lead', 'teammate')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by_user_id UUID REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique email per project
  CONSTRAINT unique_project_email UNIQUE (project_id, email),
  
  -- Ensure either email or user_id is set (email is always set, user_id is nullable)
  CONSTRAINT email_required CHECK (email IS NOT NULL AND email != '')
);

-- Create indexes for performance
CREATE INDEX idx_project_team_members_project_id ON public.project_team_members(project_id);
CREATE INDEX idx_project_team_members_email ON public.project_team_members(email);
CREATE INDEX idx_project_team_members_user_id ON public.project_team_members(user_id);
CREATE INDEX idx_project_team_members_status ON public.project_team_members(status);

-- Enable RLS
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view team members for projects they have access to
CREATE POLICY "Users can view team members for accessible projects"
ON public.project_team_members
FOR SELECT
TO authenticated
USING (
  -- User is a team member themselves
  user_id = (SELECT auth.uid())
  OR
  email = (SELECT auth.email())
  OR
  -- User is the project lead
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_team_members.project_id
    AND (
      p.lead_user_id = (SELECT auth.uid())
      OR p.lead_email = (SELECT auth.email())
    )
  )
  OR
  -- User is a teammate of the project
  EXISTS (
    SELECT 1 FROM public.project_team_members ptm2
    WHERE ptm2.project_id = project_team_members.project_id
    AND (
      ptm2.user_id = (SELECT auth.uid())
      OR ptm2.email = (SELECT auth.email())
    )
    AND ptm2.status = 'accepted'
  )
  OR
  -- User is an admin
  public.is_admin_user((SELECT auth.uid()))
);

-- Policy: Project leads and teammates can invite others
CREATE POLICY "Project leads and teammates can invite others"
ON public.project_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_team_members.project_id
    AND (
      p.lead_user_id = (SELECT auth.uid())
      OR p.lead_email = (SELECT auth.email())
      OR EXISTS (
        SELECT 1 FROM public.project_team_members ptm2
        WHERE ptm2.project_id = p.id
        AND (
          ptm2.user_id = (SELECT auth.uid())
          OR ptm2.email = (SELECT auth.email())
        )
        AND ptm2.status = 'accepted'
      )
    )
  )
);

-- Policy: Users can update their own team member status (accept/decline)
CREATE POLICY "Users can update their own team member status"
ON public.project_team_members
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR email = (SELECT auth.email())
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR email = (SELECT auth.email())
);

-- Add trigger to update updated_at
CREATE TRIGGER update_project_team_members_updated_at
  BEFORE UPDATE ON public.project_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically link team members when a user signs up
-- This is called when a user profile is created or email is updated
CREATE OR REPLACE FUNCTION link_team_members_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Update any pending team member invitations for this email
  UPDATE public.project_team_members
  SET 
    user_id = NEW.uid,
    updated_at = NOW()
  WHERE email = LOWER(NEW.email)
    AND user_id IS NULL
    AND status = 'pending';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to link team members when user profile is created
CREATE TRIGGER link_team_members_on_profile_create
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_team_members_on_signup();

-- Trigger to link team members when user email is updated
CREATE TRIGGER link_team_members_on_email_update
  AFTER UPDATE OF email ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION link_team_members_on_signup();

-- Add comments
COMMENT ON TABLE public.project_team_members IS 
'Junction table for project team members. Allows inviting by email before signup, and automatically links to user_id when user creates account.';

COMMENT ON COLUMN public.project_team_members.email IS 
'Email address of the team member. Required and always set, even before user signs up.';

COMMENT ON COLUMN public.project_team_members.user_id IS 
'User ID of the team member. Nullable - populated automatically when user signs up with matching email.';

COMMENT ON COLUMN public.project_team_members.status IS 
'Status of the invitation: pending (invited but not accepted), accepted (user joined), declined (user declined invitation).';
