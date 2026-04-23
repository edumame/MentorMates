DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'project_artifact_kind'
  ) THEN
    CREATE TYPE public.project_artifact_kind AS ENUM (
      'project_link',
      'video_link',
      'additional_material'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'submission_field_type'
  ) THEN
    CREATE TYPE public.submission_field_type AS ENUM (
      'short_text',
      'long_text',
      'url',
      'multi_url'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.project_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind public.project_artifact_kind NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_artifacts_url_not_blank CHECK (length(trim(url)) > 0),
  CONSTRAINT project_artifacts_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_project_id
  ON public.project_artifacts(project_id);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_kind
  ON public.project_artifacts(kind);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_artifacts_project_kind_order
  ON public.project_artifacts(project_id, kind, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_artifacts_primary_per_kind
  ON public.project_artifacts(project_id, kind)
  WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS public.event_submission_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  placeholder TEXT,
  field_type public.submission_field_type NOT NULL DEFAULT 'short_text',
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_submission_fields_key_not_blank CHECK (length(trim(key)) > 0),
  CONSTRAINT event_submission_fields_label_not_blank CHECK (length(trim(label)) > 0),
  CONSTRAINT event_submission_fields_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_submission_fields_event_key
  ON public.event_submission_fields(event_id, key);

CREATE INDEX IF NOT EXISTS idx_event_submission_fields_event_active_order
  ON public.event_submission_fields(event_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.project_submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_submission_field_id UUID NOT NULL REFERENCES public.event_submission_fields(id) ON DELETE CASCADE,
  answer JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_submission_answers_unique UNIQUE (project_id, event_submission_field_id)
);

CREATE INDEX IF NOT EXISTS idx_project_submission_answers_project_id
  ON public.project_submission_answers(project_id);

CREATE INDEX IF NOT EXISTS idx_project_submission_answers_field_id
  ON public.project_submission_answers(event_submission_field_id);

CREATE TRIGGER update_project_artifacts_updated_at
  BEFORE UPDATE ON public.project_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_submission_fields_updated_at
  BEFORE UPDATE ON public.event_submission_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_submission_answers_updated_at
  BEFORE UPDATE ON public.project_submission_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Backfill canonical artifacts from legacy single-value columns.
INSERT INTO public.project_artifacts (project_id, kind, label, url, sort_order, is_primary)
SELECT p.id, 'project_link', 'Project Link', trim(p.project_url), 0, true
FROM public.projects p
WHERE p.project_url IS NOT NULL
  AND length(trim(p.project_url)) > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.project_artifacts (project_id, kind, label, url, sort_order, is_primary)
SELECT p.id, 'video_link', 'Video Link', trim(p.video_url), 0, true
FROM public.projects p
WHERE p.video_url IS NOT NULL
  AND length(trim(p.video_url)) > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.project_artifacts (project_id, kind, label, url, sort_order, is_primary)
SELECT p.id, 'additional_material', 'Additional Material', trim(p.additional_materials_url), 0, true
FROM public.projects p
WHERE p.additional_materials_url IS NOT NULL
  AND length(trim(p.additional_materials_url)) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_submission_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_submission_answers ENABLE ROW LEVEL SECURITY;

-- Reset policies in case migration is re-run.
DROP POLICY IF EXISTS "project_artifacts_select_policy" ON public.project_artifacts;
DROP POLICY IF EXISTS "project_artifacts_modify_policy" ON public.project_artifacts;
DROP POLICY IF EXISTS "event_submission_fields_select_policy" ON public.event_submission_fields;
DROP POLICY IF EXISTS "event_submission_fields_modify_policy" ON public.event_submission_fields;
DROP POLICY IF EXISTS "project_submission_answers_select_policy" ON public.project_submission_answers;
DROP POLICY IF EXISTS "project_submission_answers_modify_policy" ON public.project_submission_answers;

CREATE POLICY "project_artifacts_select_policy"
ON public.project_artifacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_artifacts.project_id
      AND p.private = false
  )
  OR public.can_view_project(project_artifacts.project_id, auth.uid())
);

CREATE POLICY "project_artifacts_modify_policy"
ON public.project_artifacts
FOR ALL
TO authenticated
USING (
  public.is_project_member(project_artifacts.project_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_artifacts.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  public.is_project_member(project_artifacts.project_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_artifacts.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
);

CREATE POLICY "event_submission_fields_select_policy"
ON public.event_submission_fields
FOR SELECT
TO authenticated
USING (
  public.user_has_event_role(event_submission_fields.event_id, auth.uid())
  OR public.is_admin_user(auth.uid())
);

CREATE POLICY "event_submission_fields_modify_policy"
ON public.event_submission_fields
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = event_submission_fields.event_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = event_submission_fields.event_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
);

CREATE POLICY "project_submission_answers_select_policy"
ON public.project_submission_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_submission_answers.project_id
      AND p.private = false
  )
  OR public.can_view_project(project_submission_answers.project_id, auth.uid())
);

CREATE POLICY "project_submission_answers_modify_policy"
ON public.project_submission_answers
FOR ALL
TO authenticated
USING (
  public.is_project_member(project_submission_answers.project_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_submission_answers.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  public.is_project_member(project_submission_answers.project_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.user_event_roles uer
      ON uer.event_id = p.event_id
    WHERE p.id = project_submission_answers.project_id
      AND uer.user_id = auth.uid()
      AND uer.role = 'organizer'
  )
  OR public.is_admin_user(auth.uid())
);

COMMENT ON TABLE public.project_artifacts IS 'Canonical project resources and links (supports multiple entries per category).';
COMMENT ON TABLE public.event_submission_fields IS 'Organizer-configurable custom submission questions per event.';
COMMENT ON TABLE public.project_submission_answers IS 'Project answers for organizer-configured custom submission fields.';
