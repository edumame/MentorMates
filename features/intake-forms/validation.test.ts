import {
  DEFAULT_MAX_TEXT_LENGTH,
  getVisibleFields,
  satisfiesRequired,
  validateIntakeAnswers,
} from "./validation";
import type { IntakeFormField, IntakeFormSchema } from "./types";
import { createMLHComplianceTemplate } from "./templates/mlhCompliance";

const field = (overrides: Partial<IntakeFormField> & Pick<IntakeFormField, "key" | "type">): IntakeFormField => ({
  id: overrides.key,
  label: overrides.key,
  required: false,
  ...overrides,
});

const schema: IntakeFormSchema = {
  title: "Test",
  fields: [
    field({ key: "name", type: "short_text", required: true }),
    field({ key: "bio", type: "long_text", validation: { maxLength: 10 } }),
    field({ key: "email", type: "email" }),
    field({ key: "age", type: "number", validation: { min: 13, max: 120 } }),
    field({ key: "level", type: "single_select", required: true, options: ["A", "B"] }),
    field({ key: "langs", type: "multi_select", options: ["ts", "py"] }),
    field({ key: "coc", type: "checkbox", required: true }),
    field({ key: "optin", type: "checkbox" }),
    field({ key: "level_other", type: "short_text", required: true, showIf: { fieldKey: "level", equals: "B" } }),
  ],
};

const valid = { name: "Ada", level: "A", coc: true };

describe("validateIntakeAnswers", () => {
  it("accepts a minimal valid submission and returns only known visible answers", () => {
    const result = validateIntakeAnswers(schema, { ...valid, bio: "", optin: false, level_other: "ignored" });
    expect(result).toEqual({ ok: true, answers: { name: "Ada", level: "A", coc: true, bio: "", optin: false } });
  });

  it("rejects an empty submission listing every required field", () => {
    const result = validateIntakeAnswers(schema, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["coc", "level", "name"]);
  });

  it("treats whitespace-only text as unanswered", () => {
    const result = validateIntakeAnswers(schema, { ...valid, name: "   " });
    expect(result.ok).toBe(false);
  });

  it("requires required checkboxes (consents) to be exactly true", () => {
    for (const coc of [false, "true", 1, null]) {
      const result = validateIntakeAnswers(schema, { ...valid, coc });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects unknown keys", () => {
    const result = validateIntakeAnswers(schema, { ...valid, not_a_field: "x" });
    expect(result).toEqual({ ok: false, errors: { not_a_field: "Unknown field" } });
  });

  it("rejects select values outside the option list", () => {
    expect(validateIntakeAnswers(schema, { ...valid, level: "Z" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, langs: ["ts", "rust"] }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, langs: ["ts", "ts"] }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, langs: "ts" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, langs: ["ts", "py"] }).ok).toBe(true);
    expect(validateIntakeAnswers(schema, { ...valid, langs: [] }).ok).toBe(true);
  });

  it("enforces the conditional required field only when it is visible", () => {
    expect(validateIntakeAnswers(schema, { ...valid, level: "B" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, level: "B", level_other: "Self-taught" }).ok).toBe(true);
  });

  it("enforces text length limits (field maxLength and the default cap)", () => {
    expect(validateIntakeAnswers(schema, { ...valid, bio: "x".repeat(11) }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, name: "x".repeat(DEFAULT_MAX_TEXT_LENGTH + 1) }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, name: "x".repeat(DEFAULT_MAX_TEXT_LENGTH) }).ok).toBe(true);
  });

  it("validates email format and number ranges", () => {
    expect(validateIntakeAnswers(schema, { ...valid, email: "nope" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, email: "a@b.co" }).ok).toBe(true);
    expect(validateIntakeAnswers(schema, { ...valid, age: "12" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, age: 121 }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, age: "abc" }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, age: "30" }).ok).toBe(true);
  });

  it("rejects wrongly typed values", () => {
    expect(validateIntakeAnswers(schema, { ...valid, name: 42 }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, bio: { html: "<b>" } }).ok).toBe(false);
    expect(validateIntakeAnswers(schema, { ...valid, optin: "yes" }).ok).toBe(false);
  });

  it("enforces the MLH template's required consents and allows the optional opt-in to stay unchecked", () => {
    const mlh = createMLHComplianceTemplate();
    const answers: Record<string, unknown> = {};
    for (const f of mlh.fields) {
      if (f.type === "checkbox") answers[f.key] = f.required;
      else if (f.type === "single_select") answers[f.key] = f.options![0];
      else if (f.type === "email") answers[f.key] = "qa@example.test";
      else answers[f.key] = f.required ? "QA" : "";
    }
    expect(validateIntakeAnswers(mlh, answers).ok).toBe(true);
    const requiredCheckboxes = mlh.fields.filter((f) => f.type === "checkbox" && f.required);
    expect(requiredCheckboxes).toHaveLength(2);
    for (const consent of requiredCheckboxes) {
      expect(validateIntakeAnswers(mlh, { ...answers, [consent.key]: false }).ok).toBe(false);
    }
  });
});

describe("round 2 hardening (ORG-010)", () => {
  it("rejects answers to selects that have no options configured", () => {
    const s: IntakeFormSchema = {
      title: "t",
      fields: [
        field({ key: "pick", type: "single_select" }),
        field({ key: "many", type: "multi_select", options: [] }),
      ],
    };
    expect(validateIntakeAnswers(s, { pick: "x".repeat(10000) }).ok).toBe(false);
    expect(validateIntakeAnswers(s, { many: ["a"] }).ok).toBe(false);
    expect(validateIntakeAnswers(s, {}).ok).toBe(true);
  });

  it("parses dates", () => {
    const s: IntakeFormSchema = { title: "t", fields: [field({ key: "d", type: "date" })] };
    expect(validateIntakeAnswers(s, { d: "2026-12-01" }).ok).toBe(true);
    expect(validateIntakeAnswers(s, { d: "2026-12-01T10:00:00Z" }).ok).toBe(true);
    expect(validateIntakeAnswers(s, { d: "next tuesday" }).ok).toBe(false);
    expect(validateIntakeAnswers(s, { d: "2026-13-45" }).ok).toBe(false);
    expect(validateIntakeAnswers(s, { d: "x".repeat(4000) }).ok).toBe(false);
  });

  it("evaluates nested showIf against visible answers only", () => {
    const s: IntakeFormSchema = {
      title: "t",
      fields: [
        field({ key: "student", type: "single_select", required: true, options: ["yes", "no"] }),
        field({ key: "level", type: "single_select", options: ["hs", "uni"], showIf: { fieldKey: "student", equals: "yes" } }),
        field({ key: "school", type: "short_text", required: true, showIf: { fieldKey: "level", equals: "uni" } }),
      ],
    };
    // level is hidden (student=no), so its stale answer must not reveal school
    const hidden = validateIntakeAnswers(s, { student: "no", level: "uni" });
    expect(hidden).toEqual({ ok: true, answers: { student: "no" } });
    // visible chain: school becomes required
    expect(validateIntakeAnswers(s, { student: "yes", level: "uni" }).ok).toBe(false);
    expect(validateIntakeAnswers(s, { student: "yes", level: "uni", school: "MIT" }).ok).toBe(true);
    // controller declared after the dependent field still works
    const reversed: IntakeFormSchema = { title: "t", fields: [...s.fields].reverse() };
    expect(validateIntakeAnswers(reversed, { student: "no", level: "uni" }).ok).toBe(true);
  });
});

describe("helpers shared with ParticipantIntakeDialog", () => {
  it("getVisibleFields hides showIf fields until their condition matches", () => {
    expect(getVisibleFields(schema, { level: "A" }).map((f) => f.key)).not.toContain("level_other");
    expect(getVisibleFields(schema, { level: "B" }).map((f) => f.key)).toContain("level_other");
  });

  it("satisfiesRequired ignores optional fields", () => {
    expect(satisfiesRequired(schema.fields[1], "")).toBe(true);
    expect(satisfiesRequired(schema.fields[0], "")).toBe(false);
  });
});

describe("required selects with no usable options", () => {
  it.each(["single_select", "multi_select"] as const)(
    "does not require a %s whose options are all blank (client and server agree)",
    (type) => {
      const f = field({ key: "pick", type, required: true, options: ["", "  "] });
      expect(satisfiesRequired(f, undefined)).toBe(true);
      expect(validateIntakeAnswers({ title: "T", fields: [f] }, {})).toEqual({ ok: true, answers: {} });
    }
  );

  it("still requires a select that has at least one usable option", () => {
    const f = field({ key: "pick", type: "single_select", required: true, options: ["A", ""] });
    expect(satisfiesRequired(f, undefined)).toBe(false);
    expect(validateIntakeAnswers({ title: "T", fields: [f] }, {})).toEqual({
      ok: false,
      errors: { pick: "This field is required" },
    });
  });
});
