-- Create enum for notification type and status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
    CREATE TYPE notification_type_enum AS ENUM (
      'project_invite',
      'event_update',
      'custom',
      'project_feedback',
      'project_award'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status_enum') THEN
    CREATE TYPE notification_status_enum AS ENUM ('unread', 'read');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  type notification_type_enum NOT NULL,
  title text NOT NULL,
  body text NULL,
  data jsonb NULL,
  status notification_status_enum NOT NULL DEFAULT 'unread',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Only the recipient can read their notifications
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Only the application on behalf of the user can insert; restrict to current user
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow user to update status to read
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
