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
