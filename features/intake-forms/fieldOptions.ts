import type { IntakeFormField } from "@/features/intake-forms/types";

function isBlankOption(option: unknown) {
  return typeof option !== "string" || option.trim() === "";
}

function isSelectField(field: Pick<IntakeFormField, "type">) {
  return field.type === "single_select" || field.type === "multi_select";
}

// Forms already published may hold blank options, and Radix Select throws on an
// empty item value, so participants must only ever see this filtered list.
export function getSelectableOptions(field: Pick<IntakeFormField, "options">) {
  return (field.options ?? []).filter((option) => !isBlankOption(option));
}

export function isSelectFieldWithoutOptions(field: IntakeFormField) {
  return isSelectField(field) && getSelectableOptions(field).length === 0;
}

// `schema` is unvalidated: the routes accept `fields: z.array(z.any())` and may
// also check a stored schema_json.
export function getBlankOptionError(schema: unknown): string | null {
  const fields = (schema as { fields?: unknown } | null | undefined)?.fields;
  if (!Array.isArray(fields)) return null;

  const invalidField = (fields as (IntakeFormField | null)[]).find(
    (field) =>
      field &&
      isSelectField(field) &&
      Array.isArray(field.options) &&
      field.options.some(isBlankOption)
  );

  if (!invalidField) return null;

  const question = invalidField.label?.trim()
    ? `"${invalidField.label.trim()}"`
    : "A question";
  return `${question} has a blank option. Fill it in or remove it.`;
}
