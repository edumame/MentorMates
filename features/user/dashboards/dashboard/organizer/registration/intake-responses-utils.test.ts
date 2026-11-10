import {
  buildIntakeExportRows,
  formatAnswerValue,
  getFieldLabel,
  isFieldVisible,
  mapAnswersByFieldKey,
  type IntakeExportSubmission,
} from "./intake-responses-utils";
import type {
  IntakeFieldType,
  IntakeFormField,
  IntakeFormSchema,
} from "@/features/intake-forms/types";

function field(
  key: string,
  label: string,
  type: IntakeFieldType = "short_text"
): IntakeFormField {
  return { id: key, key, label, type, required: false };
}

function makeSchema(fields: IntakeFormField[]): IntakeFormSchema {
  return { title: "Test Form", fields };
}

function makeSubmission(
  overrides: Partial<IntakeExportSubmission> = {}
): IntakeExportSubmission {
  return {
    id: "sub-1",
    submittedAt: "2026-03-15T18:30:00.000Z",
    submitterProfile: {
      display_name: "Ada Lovelace",
      email: "ada@example.com",
    },
    answers: [],
    ...overrides,
  };
}

describe("intake-responses-utils", () => {
  describe("mapAnswersByFieldKey", () => {
    it("maps records by field key", () => {
      const result = mapAnswersByFieldKey([
        { fieldKey: "age", value: 14 },
        { fieldKey: "interests", value: ["ai", "robotics"] },
      ]);
      expect(result.age).toBe(14);
      expect(result.interests).toEqual(["ai", "robotics"]);
    });
  });

  describe("isFieldVisible", () => {
    it("respects showIf conditions", () => {
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
      const sourceField: IntakeFormField = {
        ...visibleField,
        id: "3",
        key: "role",
        showIf: null,
      };
      const fields = [sourceField, visibleField, hiddenField];
      expect(isFieldVisible(visibleField, answers, fields)).toBe(true);
      expect(isFieldVisible(hiddenField, answers, fields)).toBe(false);
    });

    it("shows a field whose showIf source is not in the schema", () => {
      const field: IntakeFormField = {
        id: "1",
        key: "school",
        type: "short_text",
        label: "School",
        required: true,
        showIf: { fieldKey: "old_key", equals: "student" },
      };
      expect(isFieldVisible(field, { old_key: "professional" }, [field])).toBe(true);
    });
  });

  describe("formatAnswerValue", () => {
    it("handles primitive and array values", () => {
      expect(formatAnswerValue("")).toBe("-");
      expect(formatAnswerValue("Ada")).toBe("Ada");
      expect(formatAnswerValue(true)).toBe("Yes");
      expect(formatAnswerValue(false)).toBe("No");
      expect(formatAnswerValue(["a", "b"])).toBe("a, b");
      expect(formatAnswerValue([])).toBe("-");
      expect(formatAnswerValue(null)).toBe("-");
    });
  });

  describe("getFieldLabel", () => {
    it("falls back to field key when schema is missing or field is unknown", () => {
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
      expect(getFieldLabel("experience", schema)).toBe("Experience Level");
      expect(getFieldLabel("unknown", schema)).toBe("unknown");
      expect(getFieldLabel("experience", null)).toBe("experience");
    });
  });

  // MLH-compliance regression tests for the intake CSV exporter.
  // MentorMates must export custom registration questions in a stable CSV
  // format per
  // https://guide.mlh.io/general-information/managing-registrations/registrations
  describe("buildIntakeExportRows — MLH compatibility", () => {
    it("emits identity columns in fixed order", () => {
      const [row] = buildIntakeExportRows([makeSubmission()], makeSchema([]));
      expect(Object.keys(row).slice(0, 4)).toEqual([
        "Submitter Name",
        "Email",
        "Submitted At",
        "Submission ID",
      ]);
    });

    it("normalizes Submitted At to ISO UTC (locale-stable)", () => {
      const [row] = buildIntakeExportRows(
        [makeSubmission({ submittedAt: "2026-03-15T18:30:00-07:00" })],
        makeSchema([])
      );
      expect(row["Submitted At"]).toBe("2026-03-16T01:30:00.000Z");
    });

    it("renders missing submitted_at as empty string, not 'Invalid Date'", () => {
      const [row] = buildIntakeExportRows(
        [makeSubmission({ submittedAt: null })],
        makeSchema([])
      );
      expect(row["Submitted At"]).toBe("");
    });

    it("renders a null submitter profile as empty strings", () => {
      const [row] = buildIntakeExportRows(
        [makeSubmission({ submitterProfile: null })],
        makeSchema([])
      );
      expect(row["Submitter Name"]).toBe("");
      expect(row.Email).toBe("");
    });

    it("emits schema fields in form-builder order (not alphabetical)", () => {
      // Order matches an MLH-compliant registration form layout.
      const schema = makeSchema([
        field("first_name", "First Name"),
        field("last_name", "Last Name"),
        field("age", "Age", "number"),
        field("phone", "Phone Number"),
        field("school", "School"),
        field("linkedin", "LinkedIn URL"),
      ]);

      const [row] = buildIntakeExportRows(
        [
          makeSubmission({
            answers: [
              { fieldKey: "first_name", value: "Ada" },
              { fieldKey: "last_name", value: "Lovelace" },
              { fieldKey: "age", value: 28 },
              { fieldKey: "phone", value: "+1-555-0100" },
              { fieldKey: "school", value: "Cambridge" },
              { fieldKey: "linkedin", value: "https://linkedin.com/in/ada" },
            ],
          }),
        ],
        schema
      );

      expect(Object.keys(row)).toEqual([
        "Submitter Name",
        "Email",
        "Submitted At",
        "Submission ID",
        "First Name",
        "Last Name",
        "Age",
        "Phone Number",
        "School",
        "LinkedIn URL",
      ]);
      expect(row["First Name"]).toBe("Ada");
      expect(row.Age).toBe("28");
      expect(row["LinkedIn URL"]).toBe("https://linkedin.com/in/ada");
    });

    it("comma-joins multi-select arrays (matches detail-view rendering)", () => {
      const [row] = buildIntakeExportRows(
        [
          makeSubmission({
            answers: [
              {
                fieldKey: "tools",
                value: ["Anthropic", "OpenAI", "Gemini"],
              },
            ],
          }),
        ],
        makeSchema([field("tools", "GenAI Tools", "multi_select")])
      );
      expect(row["GenAI Tools"]).toBe("Anthropic, OpenAI, Gemini");
    });

    it("renders the three MLH compliance checkboxes as Yes/No", () => {
      const schema = makeSchema([
        field("mlh_coc", "MLH Code of Conduct", "checkbox"),
        field("mlh_share", "MLH Data Sharing", "checkbox"),
        field("mlh_email", "MLH Email Opt-In", "checkbox"),
      ]);
      const [row] = buildIntakeExportRows(
        [
          makeSubmission({
            answers: [
              { fieldKey: "mlh_coc", value: true },
              { fieldKey: "mlh_share", value: true },
              { fieldKey: "mlh_email", value: false },
            ],
          }),
        ],
        schema
      );
      expect(row["MLH Code of Conduct"]).toBe("Yes");
      expect(row["MLH Data Sharing"]).toBe("Yes");
      expect(row["MLH Email Opt-In"]).toBe("No");
    });

    it("renders missing answers as '-' placeholder", () => {
      const [row] = buildIntakeExportRows(
        [makeSubmission({ answers: [] })],
        makeSchema([field("first_name", "First Name")])
      );
      expect(row["First Name"]).toBe("-");
    });

    it("appends orphan field keys from older schema versions; never drops them", () => {
      const rows = buildIntakeExportRows(
        [
          makeSubmission({
            id: "sub-old",
            answers: [
              { fieldKey: "first_name", value: "Ada" },
              { fieldKey: "removed_question", value: "legacy answer" },
            ],
          }),
          makeSubmission({
            id: "sub-new",
            answers: [{ fieldKey: "first_name", value: "Grace" }],
          }),
        ],
        makeSchema([field("first_name", "First Name")])
      );

      expect(Object.keys(rows[0])).toEqual([
        "Submitter Name",
        "Email",
        "Submitted At",
        "Submission ID",
        "First Name",
        "removed_question",
      ]);
      expect(rows[0].removed_question).toBe("legacy answer");
      expect(rows[1].removed_question).toBe("-");
    });

    it("falls back to field key as header when label is empty", () => {
      const [row] = buildIntakeExportRows(
        [
          makeSubmission({
            answers: [{ fieldKey: "raw_key", value: "value" }],
          }),
        ],
        makeSchema([field("raw_key", "")])
      );
      expect(row.raw_key).toBe("value");
    });

    it("returns a row per submission even when answers are empty", () => {
      const rows = buildIntakeExportRows(
        [
          makeSubmission({ id: "a", answers: [] }),
          makeSubmission({ id: "b", answers: [] }),
          makeSubmission({ id: "c", answers: [] }),
        ],
        makeSchema([field("q1", "Q1")])
      );
      expect(rows).toHaveLength(3);
      expect(rows.map((row) => row["Submission ID"])).toEqual(["a", "b", "c"]);
      expect(rows.every((row) => row.Q1 === "-")).toBe(true);
    });

    it("emits identity + orphan columns only when schema is null", () => {
      const [row] = buildIntakeExportRows(
        [
          makeSubmission({
            answers: [{ fieldKey: "orphan", value: "x" }],
          }),
        ],
        null
      );
      expect(Object.keys(row)).toEqual([
        "Submitter Name",
        "Email",
        "Submitted At",
        "Submission ID",
        "orphan",
      ]);
      expect(row.orphan).toBe("x");
    });

    describe("column header collisions", () => {
      it("exports both answers when two fields share a label", () => {
        const rows = buildIntakeExportRows(
          [
            makeSubmission({
              answers: [
                { fieldKey: "a", value: "one" },
                { fieldKey: "b", value: "two" },
              ],
            }),
            makeSubmission({
              id: "sub-2",
              answers: [{ fieldKey: "b", value: "three" }],
            }),
          ],
          makeSchema([field("a", "Dup"), field("b", "Dup"), field("c", "Other")])
        );

        expect(Object.keys(rows[0]).slice(4)).toEqual([
          "Dup (a)",
          "Dup (b)",
          "Other",
        ]);
        expect(rows[0]["Dup (a)"]).toBe("one");
        expect(rows[0]["Dup (b)"]).toBe("two");
        // Papa.unparse takes headers from the first row, so every row must
        // use the same columns.
        expect(Object.keys(rows[1])).toEqual(Object.keys(rows[0]));
        expect(rows[1]["Dup (a)"]).toBe("-");
        expect(rows[1]["Dup (b)"]).toBe("three");
      });

      it("keeps the account email when a field is labelled Email", () => {
        const [row] = buildIntakeExportRows(
          [
            makeSubmission({
              submitterProfile: { display_name: "Ada", email: "acct@x.io" },
              answers: [{ fieldKey: "email_x", value: "typed@x.io" }],
            }),
          ],
          makeSchema([field("email_x", "Email", "email")])
        );

        expect(row.Email).toBe("acct@x.io");
        expect(row["Email (email_x)"]).toBe("typed@x.io");
      });

      it("keeps the account email when an Email field is unanswered", () => {
        const [row] = buildIntakeExportRows(
          [
            makeSubmission({
              submitterProfile: { display_name: "Ada", email: "acct@x.io" },
            }),
          ],
          makeSchema([field("email_x", "Email", "email")])
        );

        expect(row.Email).toBe("acct@x.io");
        expect(row["Email (email_x)"]).toBe("-");
      });

      it.each(["Submitter Name", "Submitted At", "Submission ID"])(
        "does not overwrite the fixed %s column",
        (label) => {
          const [baseline] = buildIntakeExportRows(
            [makeSubmission()],
            makeSchema([])
          );
          const [row] = buildIntakeExportRows(
            [makeSubmission({ answers: [{ fieldKey: "q", value: "typed" }] })],
            makeSchema([field("q", label)])
          );

          expect(row[label]).toBe(baseline[label]);
          expect(row[`${label} (q)`]).toBe("typed");
        }
      );

      it("does not let an orphan key overwrite a field label", () => {
        const [row] = buildIntakeExportRows(
          [
            makeSubmission({
              answers: [
                { fieldKey: "q", value: "current" },
                { fieldKey: "School", value: "legacy" },
              ],
            }),
          ],
          makeSchema([field("q", "School")])
        );

        expect(row["School (q)"]).toBe("current");
        expect(row["School (School)"]).toBe("legacy");
      });

      it("does not let an orphan key overwrite a fixed column", () => {
        const [row] = buildIntakeExportRows(
          [
            makeSubmission({
              submitterProfile: { display_name: "Ada", email: "acct@x.io" },
              answers: [{ fieldKey: "Email", value: "legacy@x.io" }],
            }),
          ],
          makeSchema([])
        );

        expect(row.Email).toBe("acct@x.io");
        expect(row["Email (Email)"]).toBe("legacy@x.io");
      });

      it("keeps every answer when a label matches a disambiguated header", () => {
        const [row] = buildIntakeExportRows(
          [
            makeSubmission({
              answers: [
                { fieldKey: "a", value: "one" },
                { fieldKey: "b", value: "two" },
                { fieldKey: "c", value: "three" },
              ],
            }),
          ],
          makeSchema([
            field("a", "Dup"),
            field("b", "Dup"),
            field("c", "Dup (a)"),
          ])
        );

        expect(Object.values(row).slice(4)).toEqual(["one", "two", "three"]);
      });
    });
  });
});
