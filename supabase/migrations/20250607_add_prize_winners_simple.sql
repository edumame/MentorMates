-- Simple migration to add prize winner columns
-- This fixes the foreign key reference to use user_profiles(uid) instead of user_profiles(id)

ALTER TABLE prizes ADD COLUMN winning_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE prizes ADD COLUMN assigned_by UUID REFERENCES user_profiles(uid) ON DELETE SET NULL;
ALTER TABLE prizes ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX idx_prizes_winning_project_id ON prizes(winning_project_id);
CREATE INDEX idx_prizes_assigned_by ON prizes(assigned_by);