import {
  editorTypeToDb,
  dbTypeToEditor,
  fieldsToApiPayload,
  apiFieldsToEditor,
  DEFAULT_SUBMISSION_FIELDS,
  createSubmissionTemplateFields,
  type SubmissionField,
} from "./types";

describe("submission field type mapping", () => {
  describe("editorTypeToDb", () => {
    it("maps text → short_text", () => {
      expect(editorTypeToDb("text")).toBe("short_text");
    });

    it("maps textarea → long_text", () => {
      expect(editorTypeToDb("textarea")).toBe("long_text");
    });

    it("passes through direct-match types unchanged", () => {
      expect(editorTypeToDb("url")).toBe("url");
      expect(editorTypeToDb("url", true)).toBe("multi_url");
      expect(editorTypeToDb("file")).toBe("file");
      expect(editorTypeToDb("select")).toBe("select");
      expect(editorTypeToDb("multi_select")).toBe("multi_select");
      expect(editorTypeToDb("checkbox")).toBe("checkbox");
    });

    it("falls back to short_text for unknown types", () => {
      expect(editorTypeToDb("unknown" as SubmissionField["type"])).toBe("short_text");
    });
  });

  describe("dbTypeToEditor", () => {
    it("maps short_text → text", () => {
      expect(dbTypeToEditor("short_text")).toBe("text");
    });

    it("maps long_text → textarea", () => {
      expect(dbTypeToEditor("long_text")).toBe("textarea");
    });

    it("maps multi_url → url", () => {
      expect(dbTypeToEditor("multi_url")).toBe("url");
    });

    it("passes through direct-match types unchanged", () => {
      expect(dbTypeToEditor("url")).toBe("url");
      expect(dbTypeToEditor("file")).toBe("file");
      expect(dbTypeToEditor("select")).toBe("select");
      expect(dbTypeToEditor("multi_select")).toBe("multi_select");
      expect(dbTypeToEditor("checkbox")).toBe("checkbox");
    });

    it("falls back to text for unknown types", () => {
      expect(dbTypeToEditor("something_new")).toBe("text");
    });
  });

  describe("fieldsToApiPayload", () => {
    it("converts fields with correct sort_order and mapped types", () => {
      const fields: SubmissionField[] = [
        {
          id: "project_name",
          label: "Project name",
          type: "text",
          required: true,
          placeholder: "Enter name",
          helperText: "Helper",
        },
        {
          id: "tech_stack",
          label: "Tech Stack",
          type: "multi_select",
          required: false,
          placeholder: "",
          options: ["React", "Next.js", "Python"],
        },
        {
          id: "terms_ack",
          label: "Acknowledge terms",
          type: "checkbox",
          required: true,
          placeholder: "",
          options: ["I agree to the submission rules"],
        },
      ];

      const payload = fieldsToApiPayload(fields);

      expect(payload).toHaveLength(3);
      expect(payload[0]).toEqual({
        key: "project_name",
        label: "Project name",
        description: "Helper",
        placeholder: "Enter name",
        field_type: "short_text",
        required: true,
        is_active: true,
        sort_order: 0,
        options: [],
      });
      expect(payload[1]).toEqual({
        key: "tech_stack",
        label: "Tech Stack",
        description: null,
        placeholder: null,
        field_type: "multi_select",
        required: false,
        is_active: true,
        sort_order: 1,
        options: ["React", "Next.js", "Python"],
      });
      expect(payload[2]).toEqual({
        key: "terms_ack",
        label: "Acknowledge terms",
        description: null,
        placeholder: null,
        field_type: "checkbox",
        required: true,
        is_active: true,
        sort_order: 2,
        options: ["I agree to the submission rules"],
      });
    });

    it("handles empty fields array", () => {
      expect(fieldsToApiPayload([])).toEqual([]);
    });
  });

  describe("apiFieldsToEditor", () => {
    it("converts API response back to editor fields", () => {
      const apiFields = [
        {
          key: "project_name",
          label: "Project name",
          description: "A helper",
          placeholder: "Enter name",
          field_type: "short_text",
          required: true,
          options: [],
        },
        {
          key: "categories",
          label: "Categories",
          description: null,
          placeholder: null,
          field_type: "multi_select",
          required: false,
          options: ["AI", "Web3"],
        },
        {
          key: "additional_materials",
          label: "Additional Materials",
          description: "Support links",
          placeholder: "https://...",
          field_type: "multi_url",
          required: false,
          options: [],
        },
      ];

      const fields = apiFieldsToEditor(apiFields);

      expect(fields).toHaveLength(3);
      expect(fields[0]).toEqual({
        id: "project_name",
        label: "Project name",
        type: "text",
        required: true,
        placeholder: "Enter name",
        helperText: "A helper",
        options: undefined,
        multiple: false,
      });
      expect(fields[1]).toEqual({
        id: "categories",
        label: "Categories",
        type: "multi_select",
        required: false,
        placeholder: "",
        helperText: undefined,
        options: ["AI", "Web3"],
        multiple: false,
      });
      expect(fields[2]).toEqual({
        id: "additional_materials",
        label: "Additional Materials",
        type: "url",
        required: false,
        placeholder: "https://...",
        helperText: "Support links",
        options: undefined,
        multiple: true,
      });
    });

    it("round-trips through fieldsToApiPayload and back", () => {
      const original: SubmissionField[] = [
        {
          id: "demo_video",
          label: "Demo Video",
          type: "url",
          required: true,
          placeholder: "https://youtube.com/...",
          helperText: "Link to your demo",
        },
      ];

      const api = fieldsToApiPayload(original);
      const roundTripped = apiFieldsToEditor(
        api.map((f) => ({ ...f, description: f.description }))
      );

      expect(roundTripped[0].id).toBe(original[0].id);
      expect(roundTripped[0].label).toBe(original[0].label);
      expect(roundTripped[0].type).toBe(original[0].type);
      expect(roundTripped[0].required).toBe(original[0].required);
      expect(roundTripped[0].placeholder).toBe(original[0].placeholder);
      expect(roundTripped[0].helperText).toBe(original[0].helperText);
    });
  });

  describe("DEFAULT_SUBMISSION_FIELDS", () => {
    it("contains all standard fields", () => {
      expect(DEFAULT_SUBMISSION_FIELDS).toHaveLength(6);
      const ids = DEFAULT_SUBMISSION_FIELDS.map((f) => f.id);
      expect(ids).toEqual([
        "project_name",
        "project_description",
        "project_url",
        "video_url",
        "cover_image",
        "additional_materials",
      ]);
    });

    it("marks only project_name and project_description as required", () => {
      const required = DEFAULT_SUBMISSION_FIELDS.filter((f) => f.required);
      expect(required).toHaveLength(2);
      expect(required.map((f) => f.id)).toEqual([
        "project_name",
        "project_description",
      ]);
    });

    it("sets correct types for each field", () => {
      const typeMap = Object.fromEntries(
        DEFAULT_SUBMISSION_FIELDS.map((f) => [f.id, f.type])
      );
      expect(typeMap).toEqual({
        project_name: "text",
        project_description: "textarea",
        project_url: "url",
        video_url: "url",
        cover_image: "file",
        additional_materials: "url",
      });
    });

    it("creates a fresh editable template copy", () => {
      const template = createSubmissionTemplateFields();

      expect(template).toEqual(DEFAULT_SUBMISSION_FIELDS);
      expect(template).not.toBe(DEFAULT_SUBMISSION_FIELDS);
      expect(template[0]).not.toBe(DEFAULT_SUBMISSION_FIELDS[0]);
    });
  });
});
