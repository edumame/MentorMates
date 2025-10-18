-- Create enum for project invitation status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status_enum') THEN
    CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined', 'canceled', 'expired');
  END IF;
END $$;

-- project_invitations table
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
  invited_email text NOT NULL,
  invited_user_id uuid NULL REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
  hash text NOT NULL,
  message text NULL,
  status invitation_status_enum NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  declined_at timestamptz NULL,
  expires_at timestamptz NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_email ON public.project_invitations (lower(invited_email));
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations (project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations (status);

-- Ensure only one pending invite per project/email pair
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_invite_per_project_email
  ON public.project_invitations (project_id, lower(invited_email))
  WHERE status = 'pending';

-- Optional uniqueness for hash scoped to project
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invite_hash_per_project
  ON public.project_invitations (project_id, hash);

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Allow invited user (by user_id or email) and inviter to read the invite
CREATE POLICY project_invitations_select ON public.project_invitations
  FOR SELECT
  USING (
    inviter_user_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.uid = auth.uid() AND lower(coalesce(up.email, '')) = lower(invited_email)
    )
  );

-- Allow creator to insert invites for a project (application enforces project permissions)
CREATE POLICY project_invitations_insert ON public.project_invitations
  FOR INSERT
  WITH CHECK (
    inviter_user_id = auth.uid()
  );

-- Allow invited user to accept/decline their own invite while pending
CREATE POLICY project_invitations_update_invited ON public.project_invitations
  FOR UPDATE
  USING (
    status = 'pending' AND (
      invited_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.uid = auth.uid() AND lower(coalesce(up.email, '')) = lower(invited_email)
      )
    )
  )
  WITH CHECK (true);

-- Allow inviter to cancel pending invites they created
CREATE POLICY project_invitations_update_inviter ON public.project_invitations
  FOR UPDATE
  USING (
    inviter_user_id = auth.uid() AND status = 'pending'
  )
  WITH CHECK (true);

-- Allow inviter to delete invites they created
CREATE POLICY project_invitations_delete_inviter ON public.project_invitations
  FOR DELETE
  USING (
    inviter_user_id = auth.uid()
  );
