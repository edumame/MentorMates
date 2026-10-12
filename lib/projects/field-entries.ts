import { z } from "zod";
import type { Json } from "@/lib/database.types";
import type { ProjectFieldEntry, ProjectFieldEntryAttachment } from "@/lib/types";

export const MAX_ENTRY_TEXT_LENGTH = 5000;
export const MAX_ENTRY_ATTACHMENTS = 5;

export const entryAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2048),
});

/**
 * Request-body shape shared by entry create (POST) and edit (PATCH):
 * free text, uploaded attachments, or both — but never neither.
 */
export const entryContentInputSchema = z
  .object({
    content: z.string().trim().max(MAX_ENTRY_TEXT_LENGTH).optional(),
    attachments: z.array(entryAttachmentSchema).max(MAX_ENTRY_ATTACHMENTS).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.content?.length) || Boolean(value.attachments?.length),
    { message: "An entry needs text or at least one attachment" },
  );

export type EntryContentInput = z.infer<typeof entryContentInputSchema>;

/**
 * Serialize entry content for the JSONB column. Text-only entries stay plain
 * strings (the original v1 format); entries with attachments use an object.
 */
export function buildEntryContent(input: EntryContentInput): Json {
  const text = input.content ?? "";
  const attachments = input.attachments ?? [];
  if (attachments.length === 0) {
    return text;
  }
  return { text, attachments };
}

export type ProjectFieldEntryRow = {
  id: string;
  project_id: string;
  event_submission_field_id: string;
  submitter_user_id: string;
  content: unknown;
  created_at: string;
  updated_at: string;
};

function parseAttachments(value: unknown): ProjectFieldEntryAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is ProjectFieldEntryAttachment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).url === "string",
  );
}

export function entryRowToPayload(
  row: ProjectFieldEntryRow,
  displayNameByUserId?: Map<string, string | null>,
): ProjectFieldEntry {
  let text: string;
  let attachments: ProjectFieldEntryAttachment[] = [];

  if (typeof row.content === "string") {
    text = row.content;
  } else if (typeof row.content === "object" && row.content !== null) {
    const structured = row.content as Record<string, unknown>;
    text = typeof structured.text === "string" ? structured.text : "";
    attachments = parseAttachments(structured.attachments);
  } else {
    text = JSON.stringify(row.content);
  }

  return {
    id: row.id,
    project_id: row.project_id,
    event_submission_field_id: row.event_submission_field_id,
    submitter_user_id: row.submitter_user_id,
    content: text,
    attachments,
    submitter_display_name:
      displayNameByUserId?.get(row.submitter_user_id) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
