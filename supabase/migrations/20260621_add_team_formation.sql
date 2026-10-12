-- Team formation (participants form teams; organizers manage them).
-- Two tables: teams (one per group) and team_members (membership rows).
-- A per-event toggle gates the participant-facing Team tab.

-- ============================================================
-- events toggle (mirror 20260527_add_event_external_redirect_toggle.sql)
-- ============================================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS team_formation_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.team_formation_enabled IS
  'When true, participants see a Team tab to form/join teams. Organizer-controlled opt-in.';

-- ============================================================
-- teams
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.user_profiles(uid) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams(event_id);

COMMENT ON TABLE public.teams IS 'Participant-formed teams within an event. Standalone; optionally linked to a project.';
COMMENT ON COLUMN public.teams.project_id IS 'Optional link to the team''s project; nullable so teams can form before submitting.';

-- ============================================================
-- team_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (team_id, user_id),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_event ON public.team_members(user_id, event_id);

COMMENT ON TABLE public.team_members IS 'Membership rows for teams.';
COMMENT ON COLUMN public.team_members.event_id IS 'Denormalized from the team to enforce one team per user per event via UNIQUE (event_id, user_id).';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- teams: anyone with a role on the event can read.
DROP POLICY IF EXISTS "Event members can view teams" ON public.teams;
CREATE POLICY "Event members can view teams"
    ON public.teams
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = teams.event_id
              AND uer.user_id = auth.uid()
        )
        OR is_admin_user(auth.uid())
    );

-- teams: lead (creator), organizer, admin manage. Writes are funneled through the
-- API service client; these policies are defense-in-depth for direct access.
DROP POLICY IF EXISTS "Lead or organizer manages teams" ON public.teams;
CREATE POLICY "Lead or organizer manages teams"
    ON public.teams
    FOR ALL
    USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = teams.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    )
    WITH CHECK (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = teams.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );

-- team_members: event members can read.
DROP POLICY IF EXISTS "Event members can view team members" ON public.team_members;
CREATE POLICY "Event members can view team members"
    ON public.team_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = team_members.event_id
              AND uer.user_id = auth.uid()
        )
        OR is_admin_user(auth.uid())
    );

-- team_members: the team lead, the affected user (leaving), organizers, admins.
DROP POLICY IF EXISTS "Lead user or organizer manages members" ON public.team_members;
CREATE POLICY "Lead user or organizer manages members"
    ON public.team_members
    FOR ALL
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = team_members.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = team_members.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );
