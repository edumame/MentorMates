import { createMLHComplianceTemplate, MLH_PRE_MEMBERSHIP_DISCLAIMER } from "./mlhCompliance";
import { validateIntakeAnswers } from "../validation";

// Mirrors the "MLH Compliance Registration Forms" section of CLAUDE.md.
const REQUIRED_FIELDS: Array<[label: string, type: string, required: boolean]> = [
  ["First Name", "short_text", true],
  ["Last Name", "short_text", true],
  ["Age", "single_select", true],
  ["Phone Number", "short_text", true],
  ["Email", "email", true],
  ["School", "short_text", true],
  ["Level of Study", "single_select", true],
  ["Country of Residence", "single_select", true],
  ["LinkedIn URL", "short_text", false],
];

const CONSENTS: Array<[label: string, required: boolean]> = [
  [
    "I have read and agree to the MLH Code of Conduct. (https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md)",
    true,
  ],
  [
    "I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md). I further agree to the terms of both the MLH Contest Terms and Conditions (https://github.com/MLH/mlh-policies/blob/main/contest-terms.md) and the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md).",
    true,
  ],
  [
    "I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements.",
    false,
  ],
];

describe("createMLHComplianceTemplate (ORG-011)", () => {
  const template = createMLHComplianceTemplate();
  const byLabel = new Map(template.fields.map((f) => [f.label, f]));

  it("uses the exact pre-membership disclaimer as the form description", () => {
    expect(MLH_PRE_MEMBERSHIP_DISCLAIMER).toBe(
      "We are currently in the process of partnering with MLH. The following 3 checkboxes are for this partnership. If we do not end up partnering with MLH, your information will not be shared."
    );
    expect(template.description).toBe(MLH_PRE_MEMBERSHIP_DISCLAIMER);
  });

  it.each(REQUIRED_FIELDS)("has %s as %s (required=%s)", (label, type, required) => {
    const field = byLabel.get(label);
    expect(field).toBeDefined();
    expect(field!.type).toBe(type);
    expect(field!.required).toBe(required);
  });

  it("does not ask for a date of birth", () => {
    expect(template.fields.some((f) => f.type === "date" || /birth/i.test(f.label))).toBe(false);
  });

  it.each(CONSENTS)("has the consent checkbox with exact wording: %s", (label, required) => {
    const field = byLabel.get(label);
    expect(field?.type).toBe("checkbox");
    expect(field?.required).toBe(required);
  });

  it("contains exactly the spec fields plus the three consents, in order", () => {
    expect(template.fields.map((f) => f.label)).toEqual([
      ...REQUIRED_FIELDS.map(([label]) => label),
      ...CONSENTS.map(([label]) => label),
    ]);
  });

  it("uses the exact MLH Level of Study strings", () => {
    expect(byLabel.get("Level of Study")!.options).toEqual([
      "Less than Secondary / High School",
      "Secondary / High School",
      "Undergraduate University (2 year - community college, etc.)",
      "Undergraduate University (3+ year)",
      "Graduate University (Masters, Professional, Doctoral, etc.)",
      "Code School / Bootcamp",
      "Other Vocational / Trade Program or Apprenticeship",
      "Post Doctorate",
      "Other",
      "I'm not currently a student",
      "Prefer not to answer",
    ]);
  });

  it("offers the MLH verified schools as suggestions but accepts an unlisted school", () => {
    const school = byLabel.get("School")!;
    expect(school.options?.length).toBeGreaterThan(1000);
    const answers: Record<string, unknown> = {};
    for (const f of template.fields) {
      if (f.type === "checkbox") answers[f.key] = f.required;
      else if (f.type === "single_select") answers[f.key] = f.options![0];
      else if (f.type === "email") answers[f.key] = "qa@example.test";
      else answers[f.key] = "QA";
    }
    answers[school.key] = "QA fixC Unlisted Academy of Testing";
    expect(validateIntakeAnswers(template, answers).ok).toBe(true);
  });

  it("generates unique field keys on every call", () => {
    const again = createMLHComplianceTemplate();
    const keys = new Set([...template.fields, ...again.fields].map((f) => f.key));
    expect(keys.size).toBe(template.fields.length * 2);
  });
});
