import type { IntakeFormField, IntakeFormSchema } from "@/features/intake-forms/types";

export type IntakeAnswerRecord = {
  fieldKey: string;
  value: unknown;
};

export function mapAnswersByFieldKey(
  answerRecords: IntakeAnswerRecord[]
): Record<string, unknown> {
  return answerRecords.reduce<Record<string, unknown>>((acc, answer) => {
    acc[answer.fieldKey] = answer.value;
    return acc;
  }, {});
}

export function isFieldVisible(
  field: IntakeFormField,
  answersByKey: Record<string, unknown>
): boolean {
  if (!field.showIf) return true;
  const sourceValue = answersByKey[field.showIf.fieldKey];
  return String(sourceValue ?? "") === field.showIf.equals;
}

export function getFieldLabel(
  fieldKey: string,
  schema: IntakeFormSchema | null
): string {
  if (!schema) return fieldKey;
  const field = schema.fields.find((item) => item.key === fieldKey);
  return field?.label ?? fieldKey;
}

export function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim().length > 0 ? value : "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type IntakeExportSubmission = {
  id: string;
  submittedAt: string | null;
  submitterProfile: {
    display_name: string | null;
    email: string | null;
  } | null;
  answers: IntakeAnswerRecord[];
};

/**
 * Build CSV rows for intake form submissions with a deterministic column order:
 *   1. Fixed identity columns (Submitter Name / Email / Submitted At / Submission ID)
 *   2. One column per schema field (in form-builder order) using field.label
 *   3. Trailing columns for orphan field keys that exist on older submissions
 *      but are no longer present in the active schema (so historic answers are
 *      never silently dropped from the export).
 *
 * MLH requires stable exports of custom registration questions for MLH-affiliated
 * hackathons: https://guide.mlh.io/general-information/managing-registrations/registrations
 */
export function buildIntakeExportRows(
  submissions: IntakeExportSubmission[],
  schema: IntakeFormSchema | null
): Record<string, string>[] {
  const schemaFields = schema?.fields ?? [];
  const knownKeys = new Set(schemaFields.map((field) => field.key));

  const orphanKeys: string[] = [];
  const seenOrphanKeys = new Set<string>();
  for (const submission of submissions) {
    for (const answer of submission.answers) {
      if (!knownKeys.has(answer.fieldKey) && !seenOrphanKeys.has(answer.fieldKey)) {
        seenOrphanKeys.add(answer.fieldKey);
        orphanKeys.push(answer.fieldKey);
      }
    }
  }

  return submissions.map((submission) => {
    const answersByKey = mapAnswersByFieldKey(submission.answers);
    const row: Record<string, string> = {
      "Submitter Name": submission.submitterProfile?.display_name ?? "",
      Email: submission.submitterProfile?.email ?? "",
      "Submitted At": submission.submittedAt
        ? new Date(submission.submittedAt).toISOString()
        : "",
      "Submission ID": submission.id,
    };
    for (const field of schemaFields) {
      row[field.label || field.key] = formatAnswerValue(answersByKey[field.key]);
    }
    for (const key of orphanKeys) {
      row[key] = formatAnswerValue(answersByKey[key]);
    }
    return row;
  });
}
