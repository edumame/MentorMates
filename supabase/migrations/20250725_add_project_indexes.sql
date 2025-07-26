CREATE INDEX idx_projects_project_url ON "public"."projects" USING btree ("project_url");
CREATE INDEX idx_projects_event_id ON "public"."projects" USING btree ("event_id");
CREATE INDEX idx_projects_project_name ON "public"."projects" USING btree ("project_name");
alter table "public"."projects" add constraint "projects_unique_composite" unique ("project_url", "event_id", "project_name");