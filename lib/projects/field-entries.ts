import type { ProjectFieldEntry } from "@/lib/types";

export type ProjectFieldEntryRow = {
  id: string;
  project_id: string;
  event_submission_field_id: string;
  submitter_user_id: string;
  content: unknown;
  created_at: string;
  updated_at: string;
};

export function entryRowToPayload(
  row: ProjectFieldEntryRow,
  displayNameByUserId?: Map<string, string | null>,
): ProjectFieldEntry {
  return {
    id: row.id,
    project_id: row.project_id,
    event_submission_field_id: row.event_submission_field_id,
    submitter_user_id: row.submitter_user_id,
    content:
      typeof row.content === "string" ? row.content : JSON.stringify(row.content),
    submitter_display_name:
      displayNameByUserId?.get(row.submitter_user_id) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
