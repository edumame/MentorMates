-- Add organizer-controlled finalist recommendation feature

-- 1) Add flag to events to enable judge finalist recommendations
ALTER TABLE events
ADD COLUMN IF NOT EXISTS finalist_recommendation_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN events.finalist_recommendation_enabled IS 'If true, judges see a checkbox to recommend projects for finalist consideration.';

-- 2) Add per-score finalist recommendation boolean
ALTER TABLE project_scores
ADD COLUMN IF NOT EXISTS finalist_recommendation BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN project_scores.finalist_recommendation IS 'Judge recommendation that this project should advance to finals for the scored track.';
