-- Create project_assignments table
CREATE TABLE project_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    role event_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_assignment_role CHECK (role IN ('judge', 'mentor'))
);

-- Create indexes for better query performance
CREATE INDEX idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_event_id ON project_assignments(event_id);
CREATE INDEX idx_project_assignments_role ON project_assignments(role);

-- Add RLS policies
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own assignments
CREATE POLICY "Users can view own assignments"
ON project_assignments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow organizers and admins to manage assignments for their events
CREATE POLICY "Organizers can manage assignments"
ON project_assignments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_event_roles uer
        JOIN projects p ON p.event_id = uer.event_id
        WHERE uer.user_id = auth.uid()
        AND p.id = project_assignments.project_id
        AND uer.role IN ('organizer', 'admin')
    )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_project_assignments_updated_at
    BEFORE UPDATE ON project_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE project_assignments IS 'Tracks assignments of judges and mentors to specific projects';
COMMENT ON COLUMN project_assignments.project_id IS 'Reference to the project';
COMMENT ON COLUMN project_assignments.user_id IS 'Reference to the assigned user';
COMMENT ON COLUMN project_assignments.role IS 'Role of the assigned user (judge or mentor only)'; 