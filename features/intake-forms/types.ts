export type IntakeFormContext = "registration" | "project_submission";

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

