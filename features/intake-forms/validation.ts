import type {
  IntakeFormAnswers,
  IntakeFormField,
  IntakeFormSchema,
} from "./types";
import { isSelectFieldWithoutOptions } from "./fieldOptions";

/**
 * Shared intake-form answer validation, used by the participant dialog
 * (client-side UX) and by POST /api/events/[eventId]/intake-form/submissions
 * (authoritative server-side check). Keep both on this module so the rules
 * cannot drift (ORG-010).
 */

/** Hard cap for any free-text answer when the field sets no maxLength. */
export const DEFAULT_MAX_TEXT_LENGTH = 5000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// YYYY-MM-DD, optionally followed by a time (date inputs / ISO strings).
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Keys of the fields that are shown for these answers. A field with a showIf
 * rule is visible only if its controlling field is itself visible and has the
 * expected value, so a hidden controller (whose answer is dropped) can never
 * reveal or hide anything (nested showIf). Iterates to a fixed point; the
 * visible set only shrinks, so this terminates.
 */
export function getVisibleFieldKeys(
  schema: IntakeFormSchema,
  answers: IntakeFormAnswers
): Set<string> {
  let visible = new Set(schema.fields.map((field) => field.key));
  for (let pass = 0; pass <= schema.fields.length; pass++) {
    const next = new Set(
      schema.fields
        .filter((field) => {
          if (!field.showIf) return true;
          const controller = field.showIf.fieldKey;
          return (
            visible.has(controller) &&
            String(answers[controller] ?? "") === field.showIf.equals
          );
        })
        .map((field) => field.key)
    );
    if (next.size === visible.size) return next;
    visible = next;
  }
  return visible;
}

export function getVisibleFields(
  schema: IntakeFormSchema,
  answers: IntakeFormAnswers
): IntakeFormField[] {
  const visible = getVisibleFieldKeys(schema, answers);
  return schema.fields.filter((field) => visible.has(field.key));
}

/** True when a value counts as "answered" for the field's type. */
export function hasAnswer(field: IntakeFormField, value: unknown): boolean {
  if (field.type === "checkbox") return value === true;
  if (field.type === "multi_select") return Array.isArray(value) && value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

/**
 * Whether the field must be answered. A required select with no usable
 * (non-blank) options cannot be answered, so requiring it would trap the
 * participant; forms published before blank options were rejected may hold one.
 */
export function isEffectivelyRequired(field: IntakeFormField): boolean {
  return field.required && !isSelectFieldWithoutOptions(field);
}

/** Required-field check used for the dialog's inline errors. */
export function satisfiesRequired(field: IntakeFormField, value: unknown): boolean {
  return !isEffectivelyRequired(field) || hasAnswer(field, value);
}

function checkTextLength(field: IntakeFormField, value: string): string | null {
  const max = field.validation?.maxLength ?? DEFAULT_MAX_TEXT_LENGTH;
  const min = field.validation?.minLength;
  if (value.length > max) return `Must be at most ${max} characters`;
  if (min !== undefined && value.trim().length < min) return `Must be at least ${min} characters`;
  return null;
}

/** Type/option/range check for an answered value. Returns an error or null. */
function checkValue(field: IntakeFormField, value: unknown): string | null {
  switch (field.type) {
    case "short_text":
    case "long_text":
      if (typeof value !== "string") return "Must be text";
      return checkTextLength(field, value);
    case "date": {
      if (typeof value !== "string") return "Must be a date";
      const trimmed = value.trim();
      if (!DATE_PATTERN.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
        return "Must be a valid date";
      }
      return null;
    }
    case "email":
      if (typeof value !== "string") return "Must be text";
      if (!EMAIL_PATTERN.test(value.trim())) return "Must be a valid email address";
      return checkTextLength(field, value);
    case "number": {
      const numeric =
        typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
      if (!Number.isFinite(numeric)) return "Must be a number";
      if (field.validation?.min !== undefined && numeric < field.validation.min) {
        return `Must be at least ${field.validation.min}`;
      }
      if (field.validation?.max !== undefined && numeric > field.validation.max) {
        return `Must be at most ${field.validation.max}`;
      }
      return null;
    }
    case "single_select":
      // A select without options cannot be answered safely (no bound on input).
      if (!field.options?.length) return "This question has no options configured";
      if (typeof value !== "string" || !field.options.includes(value)) {
        return "Must be one of the listed options";
      }
      return null;
    case "multi_select":
      if (!field.options?.length) return "This question has no options configured";
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        return "Must be a list of the listed options";
      }
      if (value.some((item) => !field.options!.includes(item))) {
        return "Must be a list of the listed options";
      }
      if (new Set(value).size !== value.length) return "Options must not repeat";
      return null;
    case "checkbox":
      return typeof value === "boolean" ? null : "Must be checked or unchecked";
    default:
      return "Unsupported field type";
  }
}

export type IntakeValidationResult =
  | { ok: true; answers: IntakeFormAnswers }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates submitted answers against a published schema.
 * - unknown keys are rejected
 * - required visible fields must be answered (required checkboxes must be true)
 * - answered values must match the field type, options and length/range limits
 * - answers to hidden (showIf) fields are dropped
 * Returns the sanitized answers (visible, known fields only) on success.
 */
export function validateIntakeAnswers(
  schema: IntakeFormSchema,
  answers: IntakeFormAnswers
): IntakeValidationResult {
  const errors: Record<string, string> = {};
  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));

  for (const key of Object.keys(answers)) {
    if (!fieldsByKey.has(key)) errors[key] = "Unknown field";
  }

  const sanitized: IntakeFormAnswers = {};
  for (const field of getVisibleFields(schema, answers)) {
    const value = answers[field.key];
    if (!hasAnswer(field, value)) {
      if (isEffectivelyRequired(field)) {
        errors[field.key] = "This field is required";
      } else if (value !== undefined) {
        // Keep explicit "empty" answers (e.g. unchecked optional checkbox) if well-typed.
        const typeError = field.type === "checkbox" || field.type === "multi_select"
          ? checkValue(field, value)
          : value === null || typeof value === "string"
            ? null
            : "Invalid value";
        if (typeError) errors[field.key] = typeError;
        else sanitized[field.key] = value;
      }
      continue;
    }
    const error = checkValue(field, value);
    if (error) errors[field.key] = error;
    else sanitized[field.key] = value;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, answers: sanitized };
}
