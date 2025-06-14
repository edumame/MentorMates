-- Migration to support multiple winners per prize
-- Remove the single winner column from prizes
ALTER TABLE prizes DROP COLUMN IF EXISTS winning_project_id;
ALTER TABLE prizes DROP COLUMN IF EXISTS assigned_by;
ALTER TABLE prizes DROP COLUMN IF EXISTS assigned_at;

-- Create a new join table for prize winners
CREATE TABLE prize_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID REFERENCES prizes(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES user_profiles(uid) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prize_id, project_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_prize_winners_prize_id ON prize_winners(prize_id);
CREATE INDEX idx_prize_winners_project_id ON prize_winners(project_id);
CREATE INDEX idx_prize_winners_assigned_by ON prize_winners(assigned_by);