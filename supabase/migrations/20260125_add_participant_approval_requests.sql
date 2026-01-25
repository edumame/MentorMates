-- Create participant_request_status enum
CREATE TYPE participant_request_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- Create participant_approval_requests table
CREATE TABLE public.participant_approval_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    requested_role event_role NOT NULL DEFAULT 'participant',
    status participant_request_status NOT NULL DEFAULT 'pending',
    reason TEXT,
    form_responses JSONB,
    reviewed_by UUID REFERENCES public.user_profiles(uid),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id, requested_role)
);

-- Create indexes for efficient queries
CREATE INDEX idx_participant_requests_event_status
    ON public.participant_approval_requests(event_id, status);
CREATE INDEX idx_participant_requests_user
    ON public.participant_approval_requests(user_id);
CREATE INDEX idx_participant_requests_pending
    ON public.participant_approval_requests(event_id)
    WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE public.participant_approval_requests IS 'Stores participant join requests pending organizer approval';
COMMENT ON COLUMN public.participant_approval_requests.reason IS 'User-provided reason for wanting to join the event';
COMMENT ON COLUMN public.participant_approval_requests.form_responses IS 'JSON storage for future customizable form responses';
COMMENT ON COLUMN public.participant_approval_requests.requested_role IS 'The role the user is requesting (supports future per-role approval)';

-- Add approval configuration to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS require_participant_approval BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.events.require_participant_approval IS 'Whether participants need organizer approval to join this event';

-- RLS Policies

-- Enable RLS
ALTER TABLE public.participant_approval_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
    ON public.participant_approval_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create own requests"
    ON public.participant_approval_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests (e.g., withdraw)
CREATE POLICY "Users can update own pending requests"
    ON public.participant_approval_requests
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

-- Organizers/Admins can view all requests for their events
CREATE POLICY "Organizers can view event requests"
    ON public.participant_approval_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_event_roles
            WHERE user_event_roles.event_id = participant_approval_requests.event_id
                AND user_event_roles.user_id = auth.uid()
                AND user_event_roles.role IN ('organizer', 'admin')
        )
        OR is_admin_user(auth.uid())
    );

-- Organizers/Admins can update requests for their events (approve/reject)
CREATE POLICY "Organizers can update event requests"
    ON public.participant_approval_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_event_roles
            WHERE user_event_roles.event_id = participant_approval_requests.event_id
                AND user_event_roles.user_id = auth.uid()
                AND user_event_roles.role IN ('organizer', 'admin')
        )
        OR is_admin_user(auth.uid())
    );
