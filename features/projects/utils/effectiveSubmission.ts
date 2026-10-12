import {
  DEFAULT_SUBMISSION_FIELDS,
  type SubmissionField,
} from "@/components/events/submission";
import { isMultiValueSubmissionFieldType } from "@/features/projects/utils/submission";
import type {
  EventSubmissionField,
  Project,
  ProjectArtifact,
  ProjectSubmissionAnswer,
} from "@/lib/types";

export type SubmissionValue = string | string[];

export type EffectiveSubmissionField = EventSubmissionField & {
  is_virtual?: boolean;
};

const BUILT_IN_FIELD_KEYS = [
  "project_name",
  "project_description",
  "project_url",
  "video_url",
  "cover_image",
  "additional_materials",
] as const;

type BuiltInFieldKey = (typeof BUILT_IN_FIELD_KEYS)[number];

export const BUILT_IN_SUBMISSION_FIELD_KEYS = new Set<string>(BUILT_IN_FIELD_KEYS);

function defaultEditorFieldToEffectiveField(
  field: SubmissionField,
  index: number,
  eventId?: string | null
): EffectiveSubmissionField {
  const fieldType =
    field.type === "text"
      ? "short_text"
      : field.type === "textarea"
        ? "long_text"
        : field.type === "url" && field.multiple
          ? "multi_url"
          : field.type === "url"
            ? "url"
            : field.type === "file" && field.multiple
              ? "multi_file"
              : field.type === "file"
              ? "file"
              : field.type === "select"
                ? "select"
                : field.type === "multi_select"
                  ? "multi_select"
                  : "checkbox";

  return {
    id: field.id,
    event_id: eventId ?? "",
    key: field.id,
    label: field.label,
    description: field.helperText ?? null,
    placeholder: field.placeholder || null,
    field_type: fieldType,
    required: field.required,
    sort_order: index,
    is_active: true,
    options: field.options ?? [],
    max_files: field.type === "file" && field.multiple ? (field.maxFiles ?? 5) : null,
    is_virtual: true,
  };
}

export function buildDefaultSubmissionFields(
  eventId?: string | null
): EffectiveSubmissionField[] {
  return DEFAULT_SUBMISSION_FIELDS.map((field, index) =>
    defaultEditorFieldToEffectiveField(field, index, eventId)
  );
}

export function sortActiveSubmissionFields(
  fields: EventSubmissionField[]
): EventSubmissionField[] {
  // Multi-entry ("team log") fields collect per-teammate entries on the
  // project page, not a single shared answer on the submission form.
  return [...fields]
    .filter((field) => field.is_active && !field.allows_multiple_entries)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function buildEffectiveSubmissionFields(
  fields: EventSubmissionField[],
  eventId?: string | null
): EffectiveSubmissionField[] {
  const activeFields = sortActiveSubmissionFields(fields);
  if (activeFields.length > 0) {
    return activeFields;
  }

  return buildDefaultSubmissionFields(eventId);
}

export function hasConfiguredSubmissionFields(
  fields: EventSubmissionField[] | EffectiveSubmissionField[]
): boolean {
  return fields.some((field) => !("is_virtual" in field) || !field.is_virtual);
}

export function normalizeSubmissionValue(
  field: Pick<EffectiveSubmissionField, "field_type">,
  rawValue: SubmissionValue | null | undefined
): SubmissionValue {
  if (isMultiValueSubmissionFieldType(field.field_type)) {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return rawValue
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (Array.isArray(rawValue)) {
    return rawValue[0] ?? "";
  }

  return typeof rawValue === "string" ? rawValue : "";
}

function getLegacyProjectValue(project: Partial<Project>, key: BuiltInFieldKey): SubmissionValue {
  switch (key) {
    case "project_name":
      return project.project_name || "";
    case "project_description":
      return project.project_description || "";
    case "project_url":
      return project.project_url || "";
    case "video_url":
      return project.video_url || "";
    case "cover_image":
      return project.cover_image_url || "";
    case "additional_materials":
      return project.additional_materials_url ? [project.additional_materials_url] : [];
    default:
      return "";
  }
}

export function buildSubmissionAnswerMapByFieldId(
  answers: ProjectSubmissionAnswer[] | undefined
): Record<string, SubmissionValue> {
  const answerMap: Record<string, SubmissionValue> = {};

  for (const answer of answers || []) {
    answerMap[answer.event_submission_field_id] = answer.answer;
  }

  return answerMap;
}

export function hasSubmissionFieldMismatch(
  answers: ProjectSubmissionAnswer[] | undefined,
  fields: EventSubmissionField[] | EffectiveSubmissionField[]
): boolean {
  const activeFieldIds = new Set(
    fields
      .filter((field) => field.is_active)
      .map((field) => field.id)
  );

  if (activeFieldIds.size === 0) {
    return (answers?.length || 0) > 0;
  }

  return (answers || []).some(
    (answer) => !activeFieldIds.has(answer.event_submission_field_id)
  );
}

export function buildSubmissionValuesFromProject(
  project: Partial<Project>,
  fields: EffectiveSubmissionField[]
): Record<string, SubmissionValue> {
  const answerMap = buildSubmissionAnswerMapByFieldId(project.submission_answers);
  const values: Record<string, SubmissionValue> = {};

  for (const field of fields) {
    const answerValue = answerMap[field.id];

    if (answerValue !== undefined) {
      values[field.key] = normalizeSubmissionValue(field, answerValue);
      continue;
    }

    if (BUILT_IN_SUBMISSION_FIELD_KEYS.has(field.key)) {
      values[field.key] = getLegacyProjectValue(project, field.key as BuiltInFieldKey);
      continue;
    }

    values[field.key] = isMultiValueSubmissionFieldType(field.field_type)
      ? []
      : "";
  }

  return values;
}

export function buildSubmissionAnswersPayload(
  fields: EffectiveSubmissionField[],
  values: Record<string, SubmissionValue>
): Array<{
  eventSubmissionFieldId: string;
  answer: SubmissionValue;
}> {
  const answers: Array<{
    eventSubmissionFieldId: string;
    answer: SubmissionValue;
  }> = [];

  for (const field of fields) {
    if (field.is_virtual) {
      continue;
    }

    const normalizedValue = normalizeSubmissionValue(field, values[field.key]);

    if (
      Array.isArray(normalizedValue)
        ? normalizedValue.length === 0
        : normalizedValue.trim().length === 0
    ) {
      continue;
    }

    answers.push({
      eventSubmissionFieldId: field.id,
      answer: normalizedValue,
    });
  }

  return answers;
}

export function buildLegacyProjectPayloadFromValues(
  values: Record<string, SubmissionValue>
): Record<string, string | null | undefined> {
  const projectName = typeof values.project_name === "string" ? values.project_name.trim() : "";
  const projectDescription =
    typeof values.project_description === "string"
      ? values.project_description.trim()
      : "";
  const projectUrl = typeof values.project_url === "string" ? values.project_url.trim() : "";
  const videoUrl = typeof values.video_url === "string" ? values.video_url.trim() : "";
  const coverImageUrl =
    typeof values.cover_image === "string" ? values.cover_image.trim() : "";
  const additionalMaterials = Array.isArray(values.additional_materials)
    ? values.additional_materials
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : typeof values.additional_materials === "string" &&
        values.additional_materials.trim().length > 0
      ? [values.additional_materials.trim()]
      : [];

  return {
    project_name: projectName || undefined,
    project_description: projectDescription || undefined,
    project_url: projectUrl || undefined,
    video_url: videoUrl || null,
    cover_image_url: coverImageUrl || undefined,
    additional_materials_url: additionalMaterials[0] || undefined,
  };
}

export function buildNullLegacyProjectPayload(): Record<string, null> {
  return {
    project_name: null,
    project_description: null,
    project_url: null,
    video_url: null,
    cover_image_url: null,
    additional_materials_url: null,
  };
}

export function buildSyntheticArtifactsFromSubmissionValues(
  fields: EffectiveSubmissionField[],
  values: Record<string, SubmissionValue>
): ProjectArtifact[] {
  const artifacts: ProjectArtifact[] = [];

  const appendArtifact = (
    key: string,
    kind: ProjectArtifact["kind"],
    fallbackLabel: string
  ) => {
    const field = fields.find((item) => item.key === key);
    if (!field) {
      return;
    }

    const normalizedValue = normalizeSubmissionValue(field, values[key]);
    const urls = Array.isArray(normalizedValue)
      ? normalizedValue
      : normalizedValue.trim().length > 0
        ? [normalizedValue.trim()]
        : [];

    urls.forEach((url, index) => {
      artifacts.push({
        kind,
        label: index === 0 ? field.label || fallbackLabel : `${field.label || fallbackLabel} ${index + 1}`,
        url,
        sort_order: index,
        is_primary: index === 0,
      });
    });
  };

  appendArtifact("project_url", "project_link", "Project Link");
  appendArtifact("video_url", "video_link", "Video Link");
  appendArtifact("additional_materials", "additional_material", "Additional Material");

  return artifacts;
}

export function applyEffectiveSubmissionToProject<T extends Partial<Project>>(
  project: T,
  fields: EventSubmissionField[],
  answers: ProjectSubmissionAnswer[] | undefined,
  fallbackArtifacts?: ProjectArtifact[]
): T & {
  artifacts: ProjectArtifact[];
  submission_fields: EffectiveSubmissionField[];
  submission_values: Record<string, SubmissionValue>;
  has_submission_field_config: boolean;
} {
  const effectiveFields = buildEffectiveSubmissionFields(fields, project.event_id);
  const hasConfiguredFields = hasConfiguredSubmissionFields(effectiveFields);
  const submissionValues = buildSubmissionValuesFromProject(
    {
      ...project,
      submission_answers: answers,
    },
    effectiveFields
  );

  const projectName =
    typeof submissionValues.project_name === "string" && submissionValues.project_name.trim()
      ? submissionValues.project_name.trim()
      : project.project_name || "";
  const projectDescription =
    typeof submissionValues.project_description === "string"
      ? submissionValues.project_description
      : project.project_description || "";
  const projectUrl =
    typeof submissionValues.project_url === "string" && submissionValues.project_url.trim()
      ? submissionValues.project_url.trim()
      : project.project_url || "";
  const videoUrl =
    typeof submissionValues.video_url === "string" && submissionValues.video_url.trim()
      ? submissionValues.video_url.trim()
      : project.video_url || null;
  const coverImageUrl =
    typeof submissionValues.cover_image === "string" && submissionValues.cover_image.trim()
      ? submissionValues.cover_image.trim()
      : project.cover_image_url || "";
  const additionalMaterials = Array.isArray(submissionValues.additional_materials)
    ? submissionValues.additional_materials
    : typeof submissionValues.additional_materials === "string" &&
        submissionValues.additional_materials.trim().length > 0
      ? [submissionValues.additional_materials.trim()]
      : [];

  const artifacts =
    hasConfiguredFields
      ? buildSyntheticArtifactsFromSubmissionValues(effectiveFields, submissionValues)
      : fallbackArtifacts || [];

  return {
    ...project,
    project_name: projectName,
    project_description: projectDescription,
    project_url: projectUrl,
    video_url: videoUrl,
    cover_image_url: coverImageUrl || undefined,
    additional_materials_url: additionalMaterials[0] || "",
    artifacts,
    submission_answers: answers,
    submission_fields: effectiveFields,
    submission_values: submissionValues,
    has_submission_field_config: hasConfiguredFields,
  };
}
