-- Multi-round judging (issue #706)
-- Adds round_number to project_scores and a project_round_advancements table
-- to track which projects are present in which judging round.

-- 1) project_scores.round_number -----------------------------------------
ALTER TABLE public.project_scores
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 1;

-- Backfill any pre-existing rows explicitly (DEFAULT already handles it, but
-- this is a no-op safety net for older rows where the column was just added).
UPDATE public.project_scores
   SET round_number = 1
 WHERE round_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_scores_event_round
  ON public.project_scores (event_id, round_number);

-- Drop old uniqueness constraints so judges can re-score the same
-- (project, track) in subsequent rounds. Replace with a round-aware
-- constraint that matches ON CONFLICT targets used by upserts.
ALTER TABLE public.project_scores
  DROP CONSTRAINT IF EXISTS project_scores_project_id_judge_id_key;
ALTER TABLE public.project_scores
  DROP CONSTRAINT IF EXISTS project_scores_project_id_judge_id_track_id_key;

-- Round-aware unique constraint. Matches the (project_id, judge_id,
-- track_id, round_number) onConflict target in the scoring form.
ALTER TABLE public.project_scores
  ADD CONSTRAINT project_scores_project_judge_track_round_key
  UNIQUE (project_id, judge_id, track_id, round_number);

COMMENT ON COLUMN public.project_scores.round_number IS
  'Judging round this score belongs to. Defaults to 1 for single-round events.';

-- 2) project_round_advancements ------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_round_advancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  advanced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, project_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_project_round_advancements_event_round
  ON public.project_round_advancements (event_id, round_number);

ALTER TABLE public.project_round_advancements ENABLE ROW LEVEL SECURITY;

-- Anyone with judge or organizer role for the event can read advancements.
DROP POLICY IF EXISTS "advancements_select_judges_organizers"
  ON public.project_round_advancements;
CREATE POLICY "advancements_select_judges_organizers"
  ON public.project_round_advancements
  FOR SELECT
  TO authenticated
  USING (
    public.is_event_judge_or_organizer(event_id, (SELECT auth.uid()))
  );

-- Only organizers can insert/update/delete advancements.
DROP POLICY IF EXISTS "advancements_insert_organizers"
  ON public.project_round_advancements;
CREATE POLICY "advancements_insert_organizers"
  ON public.project_round_advancements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "advancements_delete_organizers"
  ON public.project_round_advancements;
CREATE POLICY "advancements_delete_organizers"
  ON public.project_round_advancements
  FOR DELETE
  TO authenticated
  USING (
    public.is_event_organizer(event_id, (SELECT auth.uid()))
  );

COMMENT ON TABLE public.project_round_advancements IS
  'Tracks which projects are eligible for each judging round. If a round has no rows, round 1 falls back to all event projects for backward compatibility.';
