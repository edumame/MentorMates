-- In-app bug reports / feature requests (ported from the Stanford Founders hub).
-- Writes happen server-side with the service role; clients only read their own rows.

CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_email TEXT,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'blocking')),
    category TEXT NOT NULL CHECK (category IN ('events', 'projects', 'judging', 'sign-in', 'emails', 'other')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    screenshot_urls TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status) WHERE NOT is_deleted;

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can see their own (non-deleted) reports; admins see all.
CREATE POLICY "bug_reports_select_own_or_admin"
ON bug_reports FOR SELECT
TO authenticated
USING (
    NOT is_deleted
    AND (reporter_id = auth.uid() OR is_admin_user(auth.uid()))
);

-- No INSERT/UPDATE/DELETE policies for clients: all writes go through the
-- API route using the service role. Deletes are soft (is_deleted flip) only.
