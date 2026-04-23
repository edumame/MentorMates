/**
 * Submission field types used in the event creation form editor.
 *
 * These use event-scraper naming internally. The `mapFieldType` helpers
 * convert between these names and the DB enum names at the API boundary.
 */

export interface SubmissionField {
  id: string;
  label: string;
  type: "text" | "textarea" | "url" | "file" | "select" | "multi_select" | "checkbox";
  required: boolean;
  placeholder: string;
  helperText?: string;
  options?: string[];
  multiple?: boolean;
  maxFiles?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// ── Type mapping: editor ↔ DB ────────────────────────────────────────

const EDITOR_TO_DB: Record<string, string> = {
  text: "short_text",
  textarea: "long_text",
  url: "url",
  file: "file",
  select: "select",
  multi_select: "multi_select",
  checkbox: "checkbox",
};

const DB_TO_EDITOR: Record<string, string> = {
  short_text: "text",
  long_text: "textarea",
  url: "url",
  multi_url: "url",
  file: "file",
  select: "select",
  multi_select: "multi_select",
  checkbox: "checkbox",
};

/** Convert editor field type → DB submission_field_type. */
export function editorTypeToDb(
  editorType: SubmissionField["type"],
  multiple?: boolean
): string {
  if (editorType === "url" && multiple) {
    return "multi_url";
  }

  return EDITOR_TO_DB[editorType] ?? "short_text";
}

/** Convert DB submission_field_type → editor field type. */
export function dbTypeToEditor(dbType: string): SubmissionField["type"] {
  return (DB_TO_EDITOR[dbType] ?? "text") as SubmissionField["type"];
}

// ── Default fields for new events ────────────────────────────────────

export const DEFAULT_SUBMISSION_FIELDS: SubmissionField[] = [
  {
    id: "project_name",
    label: "Project name",
    type: "text",
    required: true,
    placeholder: "Short description shown in the preview card",
  },
  {
    id: "project_description",
    label: "Project Description",
    type: "textarea",
    required: true,
    placeholder: "Long description or markdown",
    helperText: "Markdown supported: use headings, lists, links, and emphasis.",
  },
  {
    id: "project_url",
    label: "Project URL",
    type: "url",
    required: false,
    placeholder: "https://github.com/your-project",
    helperText: "Link to your project repo, demo, or live site.",
  },
  {
    id: "video_url",
    label: "Demo Video",
    type: "url",
    required: false,
    placeholder: "https://youtube.com/watch?v=...",
    helperText: "Link to a short demo video of your project.",
  },
  {
    id: "cover_image",
    label: "Cover Image",
    type: "file",
    required: false,
    placeholder: "Upload a cover image for your project",
  },
  {
    id: "additional_materials",
    label: "Additional Materials",
    type: "url",
    required: false,
    placeholder: "https://...",
    helperText: "Slide deck, design files, or other supporting materials.",
    multiple: true,
  },
];

export function createSubmissionTemplateFields(): SubmissionField[] {
  return DEFAULT_SUBMISSION_FIELDS.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

/** Convert a SubmissionField array → API payload for PUT /api/events/[eventId]/submission-fields */
export function fieldsToApiPayload(fields: SubmissionField[]) {
  return fields.map((field, index) => ({
    key: field.id,
    label: field.label,
    description: field.helperText || null,
    placeholder: field.placeholder || null,
    field_type: editorTypeToDb(field.type, field.multiple),
    required: field.required,
    is_active: true,
    sort_order: index,
    options: (field.options || [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0),
  }));
}

/** Convert API response fields → SubmissionField array for the editor */
export function apiFieldsToEditor(
  apiFields: Array<{
    key: string;
    label: string;
    description?: string | null;
    placeholder?: string | null;
    field_type: string;
    required: boolean;
    options?: unknown;
  }>
): SubmissionField[] {
  return apiFields.map((f) => ({
    id: f.key,
    label: f.label,
    type: dbTypeToEditor(f.field_type),
    required: f.required,
    placeholder: f.placeholder || "",
    helperText: f.description || undefined,
    options: Array.isArray(f.options) && f.options.length > 0 ? f.options : undefined,
    multiple: f.field_type === "multi_url",
  }));
}
