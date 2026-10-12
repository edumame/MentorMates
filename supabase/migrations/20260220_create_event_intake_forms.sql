-- Event intake forms: builder templates, immutable published versions,
-- event/context bindings, and participant submissions.

-- 1) Enums
CREATE TYPE public.intake_form_context AS ENUM ('registration', 'project_submission');
CREATE TYPE public.intake_form_template_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.intake_form_submission_status AS ENUM ('draft', 'submitted', 'withdrawn');

-- 2) Templates and versions
CREATE TABLE public.intake_form_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.intake_form_template_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_form_templates_event_id
  ON public.intake_form_templates(event_id);
CREATE INDEX idx_intake_form_templates_created_by
  ON public.intake_form_templates(created_by);

CREATE TABLE public.intake_form_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_template_id UUID NOT NULL REFERENCES public.intake_form_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  schema_json JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(form_template_id, version_number)
);

CREATE INDEX idx_intake_form_versions_template_id
  ON public.intake_form_versions(form_template_id);
CREATE INDEX idx_intake_form_versions_published_at
  ON public.intake_form_versions(published_at DESC NULLS LAST);

-- 3) Event bindings (active form per event + context)
CREATE TABLE public.event_intake_form_bindings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  context public.intake_form_context NOT NULL,
  form_version_id UUID NOT NULL REFERENCES public.intake_form_versions(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_intake_form_bindings_event_context
  ON public.event_intake_form_bindings(event_id, context);

CREATE UNIQUE INDEX uniq_event_intake_form_bindings_active
  ON public.event_intake_form_bindings(event_id, context)
  WHERE is_active = true;

-- 4) Submissions and answers
CREATE TABLE public.intake_form_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  context public.intake_form_context NOT NULL,
  form_version_id UUID NOT NULL REFERENCES public.intake_form_versions(id) ON DELETE RESTRICT,
  submitter_user_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.intake_form_submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (context = 'registration' AND project_id IS NULL)
    OR
    (context = 'project_submission' AND project_id IS NOT NULL)
  )
);

CREATE INDEX idx_intake_form_submissions_event_context
  ON public.intake_form_submissions(event_id, context);
CREATE INDEX idx_intake_form_submissions_submitter
  ON public.intake_form_submissions(submitter_user_id);
CREATE INDEX idx_intake_form_submissions_project
  ON public.intake_form_submissions(project_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX uniq_intake_form_submissions_registration
  ON public.intake_form_submissions(event_id, submitter_user_id)
  WHERE context = 'registration';

CREATE UNIQUE INDEX uniq_intake_form_submissions_project_submission
  ON public.intake_form_submissions(event_id, project_id, submitter_user_id)
  WHERE context = 'project_submission' AND project_id IS NOT NULL;

CREATE TABLE public.intake_form_submission_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.intake_form_submissions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submission_id, field_key)
);

CREATE INDEX idx_intake_form_submission_answers_submission
  ON public.intake_form_submission_answers(submission_id);

-- 5) Timestamps
CREATE TRIGGER update_intake_form_templates_updated_at
  BEFORE UPDATE ON public.intake_form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_intake_form_bindings_updated_at
  BEFORE UPDATE ON public.event_intake_form_bindings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intake_form_submissions_updated_at
  BEFORE UPDATE ON public.intake_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intake_form_submission_answers_updated_at
  BEFORE UPDATE ON public.intake_form_submission_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RLS
ALTER TABLE public.intake_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_intake_form_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_form_submission_answers ENABLE ROW LEVEL SECURITY;

-- intake_form_templates
CREATE POLICY "Organizers can manage intake form templates"
ON public.intake_form_templates
FOR ALL
TO authenticated
USING (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- intake_form_versions
CREATE POLICY "Participants can read active intake form versions"
ON public.intake_form_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_intake_form_bindings b
    WHERE b.form_version_id = intake_form_versions.id
      AND b.is_active = true
  )
);

CREATE POLICY "Organizers can manage intake form versions"
ON public.intake_form_versions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_templates t
    WHERE t.id = intake_form_versions.form_template_id
      AND (
        public.is_event_organizer(t.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_templates t
    WHERE t.id = intake_form_versions.form_template_id
      AND (
        public.is_event_organizer(t.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

-- event_intake_form_bindings
CREATE POLICY "Participants can read active intake form bindings"
ON public.event_intake_form_bindings
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Organizers can manage event intake form bindings"
ON public.event_intake_form_bindings
FOR ALL
TO authenticated
USING (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- intake_form_submissions
CREATE POLICY "Participants can create own intake submissions"
ON public.intake_form_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitter_user_id = (SELECT auth.uid())
);

CREATE POLICY "Participants and organizers can view intake submissions"
ON public.intake_form_submissions
FOR SELECT
TO authenticated
USING (
  submitter_user_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Participants can update own draft intake submissions"
ON public.intake_form_submissions
FOR UPDATE
TO authenticated
USING (
  submitter_user_id = (SELECT auth.uid())
  AND status = 'draft'
)
WITH CHECK (
  submitter_user_id = (SELECT auth.uid())
);

CREATE POLICY "Organizers can update intake submissions"
ON public.intake_form_submissions
FOR UPDATE
TO authenticated
USING (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
)
WITH CHECK (
  public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);

-- intake_form_submission_answers
CREATE POLICY "Participants and organizers can view intake answers"
ON public.intake_form_submission_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND (
        s.submitter_user_id = (SELECT auth.uid())
        OR public.is_event_organizer(s.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

CREATE POLICY "Participants can insert answers for own submissions"
ON public.intake_form_submission_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Participants can update answers for own draft submissions"
ON public.intake_form_submission_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = (SELECT auth.uid())
      AND s.status = 'draft'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND s.submitter_user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Organizers can manage intake answers"
ON public.intake_form_submission_answers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND (
        public.is_event_organizer(s.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.intake_form_submissions s
    WHERE s.id = intake_form_submission_answers.submission_id
      AND (
        public.is_event_organizer(s.event_id, (SELECT auth.uid()))
        OR public.is_admin_user((SELECT auth.uid()))
      )
  )
);

-- 7) Comments
COMMENT ON TYPE public.intake_form_context IS 'Context for intake form usage: event registration or project submission';
COMMENT ON TYPE public.intake_form_template_status IS 'Lifecycle status for organizer-editable intake form templates';
COMMENT ON TYPE public.intake_form_submission_status IS 'Lifecycle status for participant form submissions';

COMMENT ON TABLE public.intake_form_templates IS 'Organizer-owned intake form template metadata, scoped to an event';
COMMENT ON TABLE public.intake_form_versions IS 'Immutable snapshot of form schema at a given publish version';
COMMENT ON TABLE public.event_intake_form_bindings IS 'Binds an event+context to the active published intake form version';
COMMENT ON TABLE public.intake_form_submissions IS 'Participant submissions for registration or project submission intake forms';
COMMENT ON TABLE public.intake_form_submission_answers IS 'Per-question answer payloads for each intake form submission';
