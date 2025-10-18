-- Create invite status enum
CREATE TYPE invite_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'revoked'
);

-- Create project_invites table
CREATE TABLE IF NOT EXISTS public.project_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core references
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
    
    -- Invitee information
    invitee_email TEXT NOT NULL,
    invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if user doesn't have an account yet
    
    -- Inviter information
    invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by_name TEXT,
    invited_by_email TEXT,
    
    -- Invite details
    status invite_status NOT NULL DEFAULT 'pending',
    invite_token TEXT NOT NULL UNIQUE, -- Secure hash for the invite link
    invite_message TEXT, -- Optional personal message from inviter
    
    -- Tracking timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration date
    
    -- Metadata
    metadata JSONB, -- Store additional data like role, permissions, etc.
    
    -- Constraints
    CONSTRAINT valid_status_timestamps CHECK (
        (status = 'accepted' AND accepted_at IS NOT NULL) OR
        (status = 'declined' AND declined_at IS NOT NULL) OR
        (status IN ('pending', 'expired', 'revoked'))
    ),
    CONSTRAINT unique_pending_invite UNIQUE (project_id, invitee_email, status)
);

-- Create indexes for better query performance
CREATE INDEX idx_project_invites_project_id ON public.project_invites(project_id);
CREATE INDEX idx_project_invites_invitee_email ON public.project_invites(invitee_email);
CREATE INDEX idx_project_invites_invitee_user_id ON public.project_invites(invitee_user_id) WHERE invitee_user_id IS NOT NULL;
CREATE INDEX idx_project_invites_status ON public.project_invites(status);
CREATE INDEX idx_project_invites_invite_token ON public.project_invites(invite_token);
CREATE INDEX idx_project_invites_event_id ON public.project_invites(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_project_invites_pending_by_email ON public.project_invites(invitee_email, status) WHERE status = 'pending';
CREATE INDEX idx_project_invites_pending_by_user ON public.project_invites(invitee_user_id, status) WHERE status = 'pending' AND invitee_user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view invites sent to them (by email or user_id)
DROP POLICY IF EXISTS "Users can view own invites" ON public.project_invites;
CREATE POLICY "Users can view own invites" 
ON public.project_invites 
FOR SELECT 
TO authenticated 
USING (
    auth.uid() = invitee_user_id OR
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Project leads and teammates can view invites for their projects
DROP POLICY IF EXISTS "Project members can view invites" ON public.project_invites;
CREATE POLICY "Project members can view invites" 
ON public.project_invites 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_invites.project_id
        AND (
            p.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
            (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(p.teammates)
        )
    )
);

-- Users can update invites sent to them (accept/decline)
DROP POLICY IF EXISTS "Users can update own invites" ON public.project_invites;
CREATE POLICY "Users can update own invites" 
ON public.project_invites 
FOR UPDATE 
TO authenticated 
USING (
    auth.uid() = invitee_user_id OR
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
    auth.uid() = invitee_user_id OR
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Project leads/teammates can create invites for their projects
DROP POLICY IF EXISTS "Project members can create invites" ON public.project_invites;
CREATE POLICY "Project members can create invites" 
ON public.project_invites 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_invites.project_id
        AND (
            p.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
            (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(p.teammates)
        )
    )
);

-- Project leads/teammates can delete/revoke invites for their projects
DROP POLICY IF EXISTS "Project members can delete invites" ON public.project_invites;
CREATE POLICY "Project members can delete invites" 
ON public.project_invites 
FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_invites.project_id
        AND (
            p.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
            (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(p.teammates)
        )
    )
);

-- Add helpful comments
COMMENT ON TABLE public.project_invites IS 'Tracks project invitations and their acceptance status';
COMMENT ON COLUMN public.project_invites.invite_token IS 'Secure hash used in the invite link URL';
COMMENT ON COLUMN public.project_invites.status IS 'Current status of the invitation';
COMMENT ON COLUMN public.project_invites.invitee_user_id IS 'User ID if invitee has an account, NULL otherwise';
COMMENT ON COLUMN public.project_invites.metadata IS 'Additional data like role or permissions for the invitee';

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_project_invite_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set accepted_at or declined_at based on status change
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        NEW.accepted_at = NOW();
    ELSIF NEW.status = 'declined' AND OLD.status != 'declined' THEN
        NEW.declined_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating timestamps
DROP TRIGGER IF EXISTS trigger_update_project_invite_updated_at ON public.project_invites;
CREATE TRIGGER trigger_update_project_invite_updated_at
    BEFORE UPDATE ON public.project_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_project_invite_updated_at();

-- Create function to link invitee_user_id when a user signs up with the invited email
CREATE OR REPLACE FUNCTION link_project_invite_to_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Update any pending invites with this email to link to the new user
    UPDATE public.project_invites
    SET invitee_user_id = NEW.id
    WHERE invitee_email = NEW.email
    AND invitee_user_id IS NULL
    AND status = 'pending';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-link invites when user signs up
DROP TRIGGER IF EXISTS trigger_link_project_invite_to_user ON auth.users;
CREATE TRIGGER trigger_link_project_invite_to_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION link_project_invite_to_user();

-- Create function to create notification when invite is created
CREATE OR REPLACE FUNCTION create_project_invite_notification()
RETURNS TRIGGER AS $$
DECLARE
    project_name TEXT;
    event_name TEXT;
BEGIN
    -- Get project name
    SELECT p.project_name INTO project_name
    FROM projects p
    WHERE p.id = NEW.project_id;
    
    -- Get event name if applicable
    IF NEW.event_id IS NOT NULL THEN
        SELECT e.event_name INTO event_name
        FROM events e
        WHERE e.event_id = NEW.event_id;
    END IF;
    
    -- Create notification only if user exists
    IF NEW.invitee_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            project_id,
            event_id,
            action_url,
            metadata
        ) VALUES (
            NEW.invitee_user_id,
            'project_invite',
            'Project Invitation',
            CASE 
                WHEN event_name IS NOT NULL THEN 
                    'You were invited to ' || COALESCE(project_name, 'a project') || ' at ' || event_name
                ELSE 
                    'You were invited to ' || COALESCE(project_name, 'a project')
            END,
            NEW.project_id,
            NEW.event_id,
            '/projects/join/' || NEW.project_id || '/' || NEW.invite_token,
            jsonb_build_object(
                'invite_id', NEW.id,
                'invited_by', NEW.invited_by_name,
                'project_name', project_name,
                'event_name', event_name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create notification on invite
DROP TRIGGER IF EXISTS trigger_create_project_invite_notification ON public.project_invites;
CREATE TRIGGER trigger_create_project_invite_notification
    AFTER INSERT ON public.project_invites
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION create_project_invite_notification();
