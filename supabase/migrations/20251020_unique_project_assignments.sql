ALTER TABLE project_assignments
ADD CONSTRAINT uq_project_assignment UNIQUE (event_id, project_id, user_id, role);