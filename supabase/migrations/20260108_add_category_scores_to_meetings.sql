-- Add category_scores JSONB column to meetings table
-- Stores structured scores by category from agent evaluation

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS category_scores JSONB;

-- Create index for efficient querying of scores
CREATE INDEX IF NOT EXISTS idx_meetings_category_scores ON public.meetings USING gin (category_scores);

COMMENT ON COLUMN public.meetings.category_scores IS 'JSON object containing scores by criteria ID. Example:
{
  "problem_clarity": 75,
  "solution_clarity": 80,
  "user_value": 70,
  "feasibility": 85,
  "storytelling": 72
}
Criteria can be customized per agent/event. Default criteria:
- problem_clarity: How clearly the problem is defined
- solution_clarity: How clearly the solution is explained
- user_value: Strength of value proposition
- feasibility: Technical and business feasibility
- storytelling: Quality of presentation and narrative';
