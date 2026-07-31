-- Multi-submitter field entries ("submission logs").
--
-- Organizers can mark an event submission field with allows_multiple_entries.
-- Such fields are excluded from the single-answer project_submission_answers
-- flow (UNIQUE per project/field, no submitter) and instead collect append-only
-- entries in project_field_entries: many entries per project per field, each
-- attributed to the teammate who submitted it.

ALTER TABLE public.event_submission_fields
  ADD COLUMN IF NOT EXISTS allows_multiple_entries BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.project_field_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_submission_field_id UUID NOT NULL REFERENCES public.event_submission_fields(id) ON DELETE CASCADE,
  submitter_user_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_field_entries_project_field_created
  ON public.project_field_entries(project_id, event_submission_field_id, created_at);

CREATE INDEX IF NOT EXISTS idx_project_field_entries_submitter
  ON public.project_field_entries(submitter_user_id);

CREATE TRIGGER update_project_field_entries_updated_at
  BEFORE UPDATE ON public.project_field_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_field_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_field_entries_select_policy" ON public.project_field_entries;
DROP POLICY IF EXISTS "project_field_entries_insert_policy" ON public.project_field_entries;
DROP POLICY IF EXISTS "project_field_entries_update_policy" ON public.project_field_entries;
DROP POLICY IF EXISTS "project_field_entries_delete_policy" ON public.project_field_entries;

-- Anyone who can view the project can read its entries (mirrors
-- project_submission_answers_select_policy).
CREATE POLICY "project_field_entries_select_policy"
ON public.project_field_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_field_entries.project_id
      AND p.private = false
  )
  OR public.can_view_project(project_field_entries.project_id, auth.uid())
);

-- Entries are always attributed to the caller; project members, event
-- organizers, and admins may add them.
CREATE POLICY "project_field_entries_insert_policy"
ON public.project_field_entries
FOR INSERT
TO authenticated
WITH CHECK (
  submitter_user_id = auth.uid()
  AND (
    public.is_project_member(project_field_entries.project_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.user_event_roles uer
        ON uer.event_id = p.event_id
      WHERE p.id = project_field_entries.project_id
        AND uer.user_id = auth.uid()
        AND uer.role = 'organizer'
    )
    OR public.is_admin_user(auth.uid())
  )
);

-- Submitters can edit their own entries; organizers and admins can moderate.
CREATE POLICY "project_field_entries_update_policy"
ON public.project_field_entries
FOR UPDATE
TO authenticated
USING (
  submitter_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_field_entries.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  submitter_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_field_entries.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
);

CREATE POLICY "project_field_entries_delete_policy"
ON public.project_field_entries
FOR DELETE
TO authenticated
USING (
  submitter_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_field_entries.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
);

COMMENT ON COLUMN public.event_submission_fields.allows_multiple_entries IS
  'When true, the field collects append-only per-teammate entries in project_field_entries instead of a single shared answer.';
COMMENT ON TABLE public.project_field_entries IS
  'Append-only per-submitter entries (e.g. submission logs) for multi-entry submission fields.';
