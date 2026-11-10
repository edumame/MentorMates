/**
 * Columns of public.projects that client roles (anon/authenticated) may
 * SELECT (migration 202611080505). lead_email / teammates are deliberately
 * absent: fetch them with getTeamEmails (lib/projects/membership.ts), which
 * only returns them to team members, the event's organizers and admins.
 * Use this instead of `*` in any client-scoped query.
 */
export const PROJECT_CLIENT_COLUMNS = [
  "id",
  "lead_name",
  "project_description",
  "created_at",
  "project_name",
  "project_url",
  "additional_materials_url",
  "event_id",
  "cover_image_url",
  "video_url",
  "submitted",
  "submitted_at",
  "contextus_project_id",
  "private",
].join(", ");
