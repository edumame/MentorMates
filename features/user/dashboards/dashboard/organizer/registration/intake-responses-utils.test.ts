import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAnswerValue,
  getFieldLabel,
  isFieldVisible,
  mapAnswersByFieldKey,
} from "./intake-responses-utils";
import type { IntakeFormField, IntakeFormSchema } from "@/features/intake-forms/types";

test("mapAnswersByFieldKey maps records by field key", () => {
  const result = mapAnswersByFieldKey([
    { fieldKey: "age", value: 14 },
    { fieldKey: "interests", value: ["ai", "robotics"] },
  ]);

  assert.equal(result.age, 14);
  assert.deepEqual(result.interests, ["ai", "robotics"]);
});

test("isFieldVisible respects showIf conditions", () => {
  const answers = { role: "student" };
  const visibleField: IntakeFormField = {
    id: "1",
    key: "school",
    type: "short_text",
    label: "School",
    required: false,
    showIf: { fieldKey: "role", equals: "student" },
  };
  const hiddenField: IntakeFormField = {
    ...visibleField,
    id: "2",
    key: "company",
    showIf: { fieldKey: "role", equals: "professional" },
  };

  assert.equal(isFieldVisible(visibleField, answers), true);
  assert.equal(isFieldVisible(hiddenField, answers), false);
});

test("formatAnswerValue handles primitive and array values", () => {
  assert.equal(formatAnswerValue(""), "-");
  assert.equal(formatAnswerValue("Ada"), "Ada");
  assert.equal(formatAnswerValue(true), "Yes");
  assert.equal(formatAnswerValue(false), "No");
  assert.equal(formatAnswerValue(["a", "b"]), "a, b");
  assert.equal(formatAnswerValue([]), "-");
  assert.equal(formatAnswerValue(null), "-");
});

test("getFieldLabel falls back to field key when schema is missing", () => {
  const schema: IntakeFormSchema = {
    title: "Registration",
    fields: [
      {
        id: "1",
        key: "experience",
        type: "single_select",
        label: "Experience Level",
        required: true,
        options: ["Beginner", "Advanced"],
      },
    ],
  };

  assert.equal(getFieldLabel("experience", schema), "Experience Level");
  assert.equal(getFieldLabel("unknown", schema), "unknown");
  assert.equal(getFieldLabel("experience", null), "experience");
});
