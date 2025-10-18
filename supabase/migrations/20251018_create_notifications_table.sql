-- Create notification types enum
CREATE TYPE notification_type AS ENUM (
    'project_invite',
    'event_update',
    'event_schedule_update',
    'event_custom_update',
    'feedback_received',
    'project_submission',
    'system_announcement'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification content
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities (nullable to support different notification types)
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
    
    -- Action URLs and metadata
    action_url TEXT, -- URL to redirect when notification is clicked
    metadata JSONB, -- Additional data specific to notification type
    
    -- Status tracking
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Timestamp fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration for time-sensitive notifications
    
    CONSTRAINT valid_read_timestamp CHECK (
        (is_read = false AND read_at IS NULL) OR 
        (is_read = true AND read_at IS NOT NULL)
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_project_id ON public.notifications(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_notifications_event_id ON public.notifications(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" 
ON public.notifications 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" 
ON public.notifications 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- System/admins can insert notifications for any user
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (true); -- Will be controlled by application logic/service role

-- Add helpful comments
COMMENT ON TABLE public.notifications IS 'Stores user notifications for various events and actions';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification (project_invite, event_update, etc.)';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data specific to the notification type';
COMMENT ON COLUMN public.notifications.action_url IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN public.notifications.expires_at IS 'Optional expiration timestamp for time-sensitive notifications';

-- Create function to automatically set read_at when is_read is set to true
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-setting read_at
DROP TRIGGER IF EXISTS trigger_set_notification_read_at ON public.notifications;
CREATE TRIGGER trigger_set_notification_read_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION set_notification_read_at();
