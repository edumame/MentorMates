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
  /** Collect append-only per-teammate entries (e.g. a submission log) instead of one shared answer. */
  allowsMultipleEntries?: boolean;
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
  multi_file: "file",
  select: "select",
  multi_select: "multi_select",
  checkbox: "checkbox",
};

/** DB field types that represent an editor type with "Allow multiple entries" on. */
const MULTIPLE_DB_TYPES = new Set(["multi_url", "multi_file"]);

/** Convert editor field type → DB submission_field_type. */
export function editorTypeToDb(
  editorType: SubmissionField["type"],
  multiple?: boolean
): string {
  if (editorType === "url" && multiple) {
    return "multi_url";
  }

  if (editorType === "file" && multiple) {
    return "multi_file";
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

/** Locked project name + description only — default when the editor opens. */
export function createLockedStarterSubmissionFields(): SubmissionField[] {
  return DEFAULT_SUBMISSION_FIELDS.slice(0, 2).map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

// ── MLH compliance template ───────────────────────────────────────────

/**
 * Complete MLH Hackathon Submission Portal field set.
 * See: https://guide.mlh.io/general-information/judging-and-submissions/hackathon-submission-portal
 *
 * This is a self-contained list — it overrides the default fields rather than
 * appending to them so that labels and order exactly match the MLH spec.
 * Built-in keys (project_name, project_description, project_url, video_url,
 * cover_image, additional_materials) are reused here so existing DB plumbing
 * still resolves them correctly.
 *
 * Fields handled automatically and NOT included as form inputs:
 *   - Opt-In Prizes / Tracks   → managed via the event tracks UI
 *   - Schools of team members  → pulled from user profiles on export
 *   - Team Member First/Last/Email → pulled from user profiles on export
 */
const MLH_SUBMISSION_FIELDS: SubmissionField[] = [
  {
    id: "project_name",
    label: "Project Name",
    type: "text",
    required: true,
    placeholder: "Your project name",
  },
  {
    id: "project_url",
    label: "Submission URL",
    type: "url",
    required: false,
    placeholder: "https://devpost.com/software/your-project",
    helperText: "Link to where your project can be viewed post-event.",
  },
  {
    id: "project_description",
    label: "About the Project",
    type: "textarea",
    required: true,
    placeholder: "Tell us what your project does and how you built it…",
    helperText: "Markdown supported: use headings, lists, links, and emphasis.",
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
    id: "github_url",
    label: "Try it out / GitHub Link",
    type: "url",
    required: false,
    placeholder: "https://github.com/your-org/your-project",
    helperText: "Link to your live app or GitHub repository.",
  },
  {
    id: "domain_name",
    label: "Did you register a domain name this weekend? If so what was the domain?",
    type: "text",
    required: false,
    placeholder: "e.g. myproject.com",
  },
  {
    id: "built_with",
    label: "Built With",
    type: "text",
    required: true,
    placeholder: "e.g. Next.js, Supabase, Python",
    helperText: "List the main technologies, frameworks, and tools you used.",
  },
  {
    id: "tech_feedback",
    label: "Share feedback about any technology you interacted with at this hackathon. Remember to mention what tech you're reviewing",
    type: "textarea",
    required: false,
    placeholder: "e.g. \"Using Supabase for auth was smooth because…\"",
  },
  {
    id: "genai_tools_used",
    label: "Which of the following GenAI tools did you use this weekend?",
    type: "multi_select",
    required: true,
    placeholder: "",
    options: [
      "OpenAI",
      "Anthropic",
      "Hugging Face",
      "Llama",
      "IBM Watson",
      "Gemini",
      "Gemma",
      "DeepSeek",
      "I did not use GenAI",
      "Other",
    ],
  },
  {
    id: "genai_description",
    label: "Did you implement a generative AI model or API in your hack this weekend?",
    type: "textarea",
    required: true,
    placeholder: "If not, mark your response as 'N/A'",
    helperText: "If so, how and why did you use it? If not, mark your response as 'N/A'",
  },
  {
    id: "gemini_api_key",
    label: "If you are submitting to the Best Use of Gemini API prize category, please provide your Gemini API Key Project Number.",
    type: "text",
    required: false,
    placeholder: "Enter your Project Number",
    helperText:
      "Head over to Gemini AI Studio > Click the 'Get API Key' button > Click the 'Project Number' for your API Key > Copy the 'Project Number' and submit below",
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

/** Returns the complete MLH-compliant submission field set. */
export function createMLHSubmissionTemplateFields(): SubmissionField[] {
  return MLH_SUBMISSION_FIELDS.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

/** Field ids that map onto built-in project columns and cannot become entry logs. */
export const BUILT_IN_FIELD_IDS = new Set(
  DEFAULT_SUBMISSION_FIELDS.map((field) => field.id)
);

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
    allows_multiple_entries:
      (field.allowsMultipleEntries ?? false) && !BUILT_IN_FIELD_IDS.has(field.id),
    max_files:
      field.type === "file" && field.multiple ? (field.maxFiles ?? 5) : null,
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
    allows_multiple_entries?: boolean;
    max_files?: number | null;
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
    multiple: MULTIPLE_DB_TYPES.has(f.field_type),
    maxFiles: f.field_type === "multi_file" ? (f.max_files ?? undefined) : undefined,
    allowsMultipleEntries: f.allows_multiple_entries || undefined,
  }));
}
