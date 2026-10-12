export const INTAKE_FORM_CONTEXTS = [
  "registration",
  "project_submission",
  "rsvp",
  "post_survey",
] as const;

export type IntakeFormContext = (typeof INTAKE_FORM_CONTEXTS)[number];

// Contexts whose submissions are one-per-user and never tied to a project.
export const PER_USER_INTAKE_FORM_CONTEXTS = [
  "registration",
  "rsvp",
  "post_survey",
] as const;

export type PerUserIntakeFormContext =
  (typeof PER_USER_INTAKE_FORM_CONTEXTS)[number];

export type IntakeFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "checkbox";

export type IntakeFormFieldValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
};

export type IntakeFormField = {
  id: string;
  key: string;
  type: IntakeFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  searchable?: boolean;
  popularOptions?: string[];
  validation?: IntakeFormFieldValidation;
  showIf?: {
    fieldKey: string;
    equals: string;
  } | null;
};

export type IntakeFormSchema = {
  title: string;
  description?: string;
  fields: IntakeFormField[];
};

export type IntakeFormAnswers = Record<string, unknown>;

