-- Create event approval logs table
CREATE TABLE IF NOT EXISTS public.event_approval_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_status public.approval_status,
  new_status public.approval_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX idx_event_approval_logs_event_id ON public.event_approval_logs(event_id);
CREATE INDEX idx_event_approval_logs_admin_user_id ON public.event_approval_logs(admin_user_id);
CREATE INDEX idx_event_approval_logs_created_at ON public.event_approval_logs(created_at DESC);

-- Add RLS policies
ALTER TABLE public.event_approval_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all logs
CREATE POLICY "Admins can view all approval logs"
  ON public.event_approval_logs
  FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Allow admins to insert logs (this will be done via API)
CREATE POLICY "Admins can insert approval logs"
  ON public.event_approval_logs
  FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

-- Allow event organizers to view logs for their own events
CREATE POLICY "Event organizers can view logs for their events"
  ON public.event_approval_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.event_id = event_approval_logs.event_id
      AND events.owner_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE public.event_approval_logs IS 'Logs all approval status changes for events, tracking who approved/rejected and when';
COMMENT ON COLUMN public.event_approval_logs.previous_status IS 'The approval status before the change (null for initial status)';
COMMENT ON COLUMN public.event_approval_logs.new_status IS 'The approval status after the change';
COMMENT ON COLUMN public.event_approval_logs.notes IS 'Optional notes from the admin about the approval/rejection decision';
