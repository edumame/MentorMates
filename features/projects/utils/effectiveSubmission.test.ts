import {
  applyEffectiveSubmissionToProject,
  buildEffectiveSubmissionFields,
  buildSubmissionAnswersPayload,
  findMissingRequiredSubmissionAnswer,
  hasSubmissionFieldMismatch,
  hasConfiguredSubmissionFields,
} from "./effectiveSubmission";
import type {
  EventSubmissionField,
  Project,
  ProjectSubmissionAnswer,
} from "@/lib/types";

describe("effective submission helpers", () => {
  const configuredFields: EventSubmissionField[] = [
    {
      id: "field-project-name",
      event_id: "event-1",
      key: "project_name",
      label: "Project name",
      field_type: "short_text",
      required: true,
      sort_order: 0,
      is_active: true,
    },
    {
      id: "field-project-url",
      event_id: "event-1",
      key: "project_url",
      label: "Project URL",
      field_type: "url",
      required: false,
      sort_order: 1,
      is_active: true,
    },
    {
      id: "field-cover-image",
      event_id: "event-1",
      key: "cover_image",
      label: "Cover Image",
      field_type: "file",
      required: false,
      sort_order: 2,
      is_active: true,
    },
    {
      id: "field-materials",
      event_id: "event-1",
      key: "additional_materials",
      label: "Additional Materials",
      field_type: "multi_url",
      required: false,
      sort_order: 3,
      is_active: true,
    },
    {
      id: "field-tech-stack",
      event_id: "event-1",
      key: "tech_stack",
      label: "Tech Stack",
      field_type: "multi_select",
      required: false,
      sort_order: 4,
      is_active: true,
      options: ["Next.js", "Supabase"],
    },
  ];

  it("excludes multi-entry (team log) fields from the effective form", () => {
    const withLogField: EventSubmissionField[] = [
      ...configuredFields,
      {
        id: "field-submission-log",
        event_id: "event-1",
        key: "submission_log",
        label: "Submission Log",
        field_type: "long_text",
        required: false,
        sort_order: 99,
        is_active: true,
        allows_multiple_entries: true,
      },
    ];

    const effective = buildEffectiveSubmissionFields(withLogField, "event-1");

    expect(effective.map((field) => field.key)).not.toContain("submission_log");
    expect(effective).toHaveLength(configuredFields.length);
  });

  it("falls back to the default project schema when no event config exists", () => {
    const effectiveFields = buildEffectiveSubmissionFields([], "event-1");

    expect(effectiveFields).toHaveLength(6);
    expect(hasConfiguredSubmissionFields(effectiveFields)).toBe(false);
    expect(effectiveFields.map((field) => field.key)).toEqual([
      "project_name",
      "project_description",
      "project_url",
      "video_url",
      "cover_image",
      "additional_materials",
    ]);
  });

  it("builds answer payloads from configured fields only", () => {
    const answers = buildSubmissionAnswersPayload(configuredFields, {
      project_name: "Shipyard",
      project_url: "https://example.com/demo",
      cover_image: "https://cdn.example.com/cover.png",
      additional_materials: [
        "https://example.com/deck",
        "https://example.com/spec",
      ],
      tech_stack: ["Next.js", "Supabase"],
    });

    expect(answers).toEqual([
      {
        eventSubmissionFieldId: "field-project-name",
        answer: "Shipyard",
      },
      {
        eventSubmissionFieldId: "field-project-url",
        answer: "https://example.com/demo",
      },
      {
        eventSubmissionFieldId: "field-cover-image",
        answer: "https://cdn.example.com/cover.png",
      },
      {
        eventSubmissionFieldId: "field-materials",
        answer: ["https://example.com/deck", "https://example.com/spec"],
      },
      {
        eventSubmissionFieldId: "field-tech-stack",
        answer: ["Next.js", "Supabase"],
      },
    ]);
  });

  it("keeps multi-file answers as arrays and drops blank entries", () => {
    const multiFileField: EventSubmissionField = {
      id: "field-screenshots",
      event_id: "event-1",
      key: "screenshots",
      label: "Screenshots",
      field_type: "multi_file",
      required: false,
      sort_order: 5,
      is_active: true,
      max_files: 8,
    };

    const answers = buildSubmissionAnswersPayload(
      [...configuredFields, multiFileField],
      {
        project_name: "Shipyard",
        screenshots: [
          "https://cdn.example.com/one.png",
          " ",
          "https://cdn.example.com/two.png",
        ],
      }
    );

    expect(answers).toContainEqual({
      eventSubmissionFieldId: "field-screenshots",
      answer: [
        "https://cdn.example.com/one.png",
        "https://cdn.example.com/two.png",
      ],
    });
  });

  it("detects when stored answers reference removed submission fields", () => {
    expect(
      hasSubmissionFieldMismatch(
        [
          {
            id: "answer-1",
            project_id: "project-1",
            event_submission_field_id: "removed-field",
            answer: "Legacy answer",
          },
        ],
        configuredFields
      )
    ).toBe(true);
  });

  it("treats orphaned answers as a mismatch when no configured fields remain", () => {
    expect(
      hasSubmissionFieldMismatch(
        [
          {
            id: "answer-1",
            project_id: "project-1",
            event_submission_field_id: "old-field",
            answer: "Legacy answer",
          },
        ],
        []
      )
    ).toBe(true);
  });

  it("hydrates project views from configured submission answers and synthesizes artifacts", () => {
    const answers: ProjectSubmissionAnswer[] = [
      {
        id: "answer-1",
        project_id: "project-1",
        event_submission_field_id: "field-project-name",
        answer: "Shipyard",
      },
      {
        id: "answer-2",
        project_id: "project-1",
        event_submission_field_id: "field-project-url",
        answer: "https://example.com/demo",
      },
      {
        id: "answer-3",
        project_id: "project-1",
        event_submission_field_id: "field-cover-image",
        answer: "https://cdn.example.com/cover.png",
      },
      {
        id: "answer-4",
        project_id: "project-1",
        event_submission_field_id: "field-materials",
        answer: ["https://example.com/deck", "https://example.com/spec"],
      },
      {
        id: "answer-5",
        project_id: "project-1",
        event_submission_field_id: "field-tech-stack",
        answer: ["Next.js", "Supabase"],
      },
    ];

    const project = applyEffectiveSubmissionToProject(
      {
        id: "project-1",
        event_id: "event-1",
        track_ids: [],
        created_at: "2026-03-16T00:00:00Z",
        lead_name: "Lead",
        lead_email: "lead@example.com",
        project_name: "",
        project_description: "",
      } as Partial<Project>,
      configuredFields,
      answers,
      [
        {
          kind: "project_link",
          label: "Legacy Project Link",
          url: "https://legacy.example.com",
          sort_order: 0,
          is_primary: true,
          metadata: null,
        },
      ]
    );

    expect(project.has_submission_field_config).toBe(true);
    expect(project.project_name).toBe("Shipyard");
    expect(project.project_url).toBe("https://example.com/demo");
    expect(project.cover_image_url).toBe("https://cdn.example.com/cover.png");
    expect(project.additional_materials_url).toBe("https://example.com/deck");
    expect(project.submission_values).toEqual({
      project_name: "Shipyard",
      project_url: "https://example.com/demo",
      cover_image: "https://cdn.example.com/cover.png",
      additional_materials: [
        "https://example.com/deck",
        "https://example.com/spec",
      ],
      tech_stack: ["Next.js", "Supabase"],
    });
    expect(project.artifacts).toEqual([
      {
        kind: "project_link",
        label: "Project URL",
        url: "https://example.com/demo",
        sort_order: 0,
        is_primary: true,
      },
      {
        kind: "additional_material",
        label: "Additional Materials",
        url: "https://example.com/deck",
        sort_order: 0,
        is_primary: true,
      },
      {
        kind: "additional_material",
        label: "Additional Materials 2",
        url: "https://example.com/spec",
        sort_order: 1,
        is_primary: false,
      },
    ]);
  });

  it("keeps the legacy read model when no configured fields exist", () => {
    const project = applyEffectiveSubmissionToProject(
      {
        id: "project-2",
        event_id: "event-1",
        track_ids: [],
        created_at: "2026-03-16T00:00:00Z",
        lead_name: "Lead",
        lead_email: "lead@example.com",
        project_name: "Legacy Project",
        project_description: "Legacy description",
        project_url: "https://legacy.example.com/demo",
        additional_materials_url: "https://legacy.example.com/deck",
      } as Partial<Project>,
      [],
      [],
      [
        {
          kind: "project_link",
          label: "Legacy Project Link",
          url: "https://legacy.example.com/demo",
          sort_order: 0,
          is_primary: true,
          metadata: null,
        },
      ]
    );

    expect(project.has_submission_field_config).toBe(false);
    expect(project.project_name).toBe("Legacy Project");
    expect(project.project_url).toBe("https://legacy.example.com/demo");
    expect(project.artifacts).toEqual([
      {
        kind: "project_link",
        label: "Legacy Project Link",
        url: "https://legacy.example.com/demo",
        sort_order: 0,
        is_primary: true,
        metadata: null,
      },
    ]);
  });
});

describe("findMissingRequiredSubmissionAnswer", () => {
  const field = (
    overrides: Partial<EventSubmissionField>,
  ): EventSubmissionField => ({
    id: "field-demo",
    event_id: "event-1",
    key: "demo",
    label: "Demo",
    field_type: "url",
    required: true,
    sort_order: 0,
    is_active: true,
    ...overrides,
  });

  it("returns the first required field without an answer", () => {
    expect(
      findMissingRequiredSubmissionAnswer([field({})], { answers: [] })?.id,
    ).toBe("field-demo");
  });

  it("accepts answered required fields and ignores optional ones", () => {
    expect(
      findMissingRequiredSubmissionAnswer(
        [field({}), field({ id: "opt", key: "opt", required: false })],
        { answers: [{ eventSubmissionFieldId: "field-demo", answer: "https://x.test" }] },
      ),
    ).toBeUndefined();
  });

  it("treats blank strings, empty lists and unchecked checkboxes as missing", () => {
    expect(
      findMissingRequiredSubmissionAnswer([field({})], {
        answers: [{ eventSubmissionFieldId: "field-demo", answer: "  " }],
      }),
    ).toBeDefined();
    expect(
      findMissingRequiredSubmissionAnswer([field({ field_type: "multi_url" })], {
        answers: [{ eventSubmissionFieldId: "field-demo", answer: ["", " "] }],
      }),
    ).toBeDefined();
    expect(
      findMissingRequiredSubmissionAnswer([field({ field_type: "checkbox" })], {
        answers: [{ eventSubmissionFieldId: "field-demo", answer: "false" }],
      }),
    ).toBeDefined();
    expect(
      findMissingRequiredSubmissionAnswer([field({ field_type: "checkbox" })], {
        answers: [{ eventSubmissionFieldId: "field-demo", answer: "true" }],
      }),
    ).toBeUndefined();
  });

  it("falls back to the project name and description for locked fields", () => {
    const fields = [
      field({ id: "name", key: "project_name", field_type: "short_text" }),
      field({ id: "desc", key: "project_description", field_type: "long_text" }),
    ];
    expect(
      findMissingRequiredSubmissionAnswer(fields, {
        projectName: "Name",
        projectDescription: "Desc",
        answers: [],
      }),
    ).toBeUndefined();
    expect(
      findMissingRequiredSubmissionAnswer(fields, {
        projectName: "Name",
        answers: [],
      })?.id,
    ).toBe("desc");
  });
});
