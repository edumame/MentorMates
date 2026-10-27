import {
  normalizeProjectWriteInput,
  ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES,
  saveProjectSubmission,
} from "./submission-service";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
  fetchSubmissionFieldsByEventIds,
  hydrateProjectsWithSubmissionData,
} from "@/lib/projects/query";

jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));

jest.mock("@/lib/projects/query", () => ({
  fetchArtifactsByProjectIds: jest.fn(),
  fetchSubmissionAnswersByProjectIds: jest.fn(),
  fetchSubmissionFieldsByEventIds: jest.fn(),
  hydrateProjectsWithSubmissionData: jest.fn(),
}));

describe("saveProjectSubmission", () => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const projectNameFieldId = "33333333-3333-4333-8333-333333333333";
  const projectDescriptionFieldId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSubmissionFieldsByEventIds as jest.Mock).mockResolvedValue(new Map());
    (fetchSubmissionAnswersByProjectIds as jest.Mock).mockResolvedValue(
      new Map(),
    );
    (fetchArtifactsByProjectIds as jest.Mock).mockResolvedValue(new Map());
    (hydrateProjectsWithSubmissionData as jest.Mock).mockImplementation(
      (projects) => projects,
    );
  });

  it("syncs locked project name and description answers onto the project row", async () => {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          event_id: eventId,
          event_name: "Demo Day",
          submission_time_start: null,
          submission_time_cutoff: null,
        },
        error: null,
      }),
    };

    const submissionFieldsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: [
          {
            id: projectNameFieldId,
            event_id: eventId,
            key: "project_name",
            field_type: "short_text",
            is_active: true,
          },
          {
            id: projectDescriptionFieldId,
            event_id: eventId,
            key: "project_description",
            field_type: "long_text",
            is_active: true,
          },
        ],
        error: null,
      }),
    };

    const existingProjectQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          id: projectId,
          event_id: eventId,
          contextus_project_id: "ctx-1",
        },
        error: null,
      }),
    };

    const updatedProjectQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          id: projectId,
          project_name: "Locked Project Name",
          lead_name: "Lead",
          lead_email: "lead@example.com",
          project_description: "Locked Project Description",
          teammates: [],
          project_url: null,
          video_url: null,
          additional_materials_url: null,
          cover_image_url: null,
          event_id: eventId,
          contextus_project_id: "ctx-1",
          private: true,
          created_at: "2026-04-16T12:00:00.000Z",
          submitted: true,
          submitted_at: "2026-04-16T12:00:00.000Z",
          project_tracks: [],
        },
        error: null,
      }),
    };

    const projectUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const projectsTable = {
      select: jest
        .fn()
        .mockReturnValueOnce(existingProjectQuery)
        .mockReturnValueOnce(updatedProjectQuery),
      update: jest.fn().mockReturnValue({
        eq: projectUpdateEq,
      }),
    };

    const deleteAnswersEq = jest.fn().mockResolvedValue({ error: null });
    const insertAnswers = jest.fn().mockResolvedValue({ error: null });
    const submissionAnswersTable = {
      delete: jest.fn().mockReturnValue({
        eq: deleteAnswersEq,
      }),
      insert: insertAnswers,
    };

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return eventsQuery;
        }

        if (table === "event_submission_fields") {
          return submissionFieldsQuery;
        }

        if (table === "projects") {
          return projectsTable;
        }

        if (table === "project_submission_answers") {
          return submissionAnswersTable;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "update",
      projectId,
      input: {
        submissionAnswers: [
          {
            eventSubmissionFieldId: projectNameFieldId,
            answer: "Locked Project Name",
          },
          {
            eventSubmissionFieldId: projectDescriptionFieldId,
            answer: "Locked Project Description",
          },
        ],
        isPrivate: true,
        submitted: true,
      },
    });

    expect(result).toMatchObject({
      status: 200,
      project: expect.objectContaining({
        id: projectId,
        project_name: "Locked Project Name",
        project_description: "Locked Project Description",
      }),
    });

    expect(projectsTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        project_name: "Locked Project Name",
        project_description: "Locked Project Description",
        project_url: null,
        video_url: null,
        cover_image_url: null,
        additional_materials_url: null,
        private: true,
        submitted: true,
        submitted_at: expect.any(String),
      }),
    );

    expect(insertAnswers).toHaveBeenCalledWith([
      {
        project_id: projectId,
        event_submission_field_id: projectNameFieldId,
        answer: "Locked Project Name",
      },
      {
        project_id: projectId,
        event_submission_field_id: projectDescriptionFieldId,
        answer: "Locked Project Description",
      },
    ]);

    expect(createContextusProject).not.toHaveBeenCalled();
  });

  it("returns a mismatch error when saved answers reference removed fields", async () => {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          event_id: eventId,
          event_name: "Demo Day",
          submission_time_start: null,
          submission_time_cutoff: null,
        },
        error: null,
      }),
    };

    const submissionFieldsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const existingProjectQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          id: projectId,
          event_id: eventId,
          contextus_project_id: "ctx-1",
        },
        error: null,
      }),
    };

    const projectUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const projectsTable = {
      select: jest.fn().mockReturnValue(existingProjectQuery),
      update: jest.fn().mockReturnValue({
        eq: projectUpdateEq,
      }),
    };

    const deleteAnswersEq = jest.fn().mockResolvedValue({ error: null });
    const submissionAnswersTable = {
      delete: jest.fn().mockReturnValue({
        eq: deleteAnswersEq,
      }),
      insert: jest.fn(),
    };

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return eventsQuery;
        }

        if (table === "event_submission_fields") {
          return submissionFieldsQuery;
        }

        if (table === "projects") {
          return projectsTable;
        }

        if (table === "project_submission_answers") {
          return submissionAnswersTable;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "update",
      projectId,
      input: {
        submissionAnswers: [
          {
            eventSubmissionFieldId: projectNameFieldId,
            answer: "Outdated answer",
          },
        ],
      },
    });

    expect(result).toEqual({
      error:
        "This project's saved submission fields no longer match the event's current submission form.",
      code: "submission_field_mismatch",
      status: 400,
    });

    expect(projectsTable.update).not.toHaveBeenCalled();
  });

  it("does not insert a project before rejecting mismatched create answers", async () => {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          event_id: eventId,
          event_name: "Demo Day",
          submission_time_start: null,
          submission_time_cutoff: null,
        },
        error: null,
      }),
    };

    const submissionFieldsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const projectsTable = {
      insert: jest.fn(),
    };

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return eventsQuery;
        }

        if (table === "event_submission_fields") {
          return submissionFieldsQuery;
        }

        if (table === "projects") {
          return projectsTable;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: {
        eventId,
        leadName: "Lead",
        submissionAnswers: [
          {
            eventSubmissionFieldId: projectNameFieldId,
            answer: "Outdated answer",
          },
        ],
      },
    });

    expect(result).toEqual({
      error:
        "This project's saved submission fields no longer match the event's current submission form.",
      code: "submission_field_mismatch",
      status: 400,
    });

    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("logs the underlying insert error when project creation fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const insertError = { message: "null value in column \"lead_name\"" };
    const insertSelectQuery = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: null,
        error: insertError,
      }),
    };

    const projectsTable = {
      insert: jest.fn().mockReturnValue(insertSelectQuery),
    };

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "projects") {
          return projectsTable;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: {
        leadName: "Lead",
        projectName: "Project A",
        projectDescription: "A description.",
      },
    });

    expect(result).toEqual({
      error: "Failed to create project",
      status: 500,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to create project:",
      insertError,
    );

    consoleErrorSpy.mockRestore();
  });

  it("rejects create when locked project_name is missing", async () => {
    const projectsTable = { insert: jest.fn() };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "projects") return projectsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: {
        leadName: "Lead",
        projectDescription: "A description.",
      },
    });

    expect(result).toMatchObject({
      code: "locked_field_missing",
      status: 400,
    });
    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("rejects create when locked project_description is missing", async () => {
    const projectsTable = { insert: jest.fn() };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "projects") return projectsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: {
        leadName: "Lead",
        projectName: "Project A",
      },
    });

    expect(result).toMatchObject({
      code: "locked_field_missing",
      status: 400,
    });
    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("rejects update when input clears the locked project_name", async () => {
    const existingProjectQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          id: projectId,
          event_id: null,
          contextus_project_id: null,
          project_name: "Existing Name",
          project_description: "Existing Description",
        },
        error: null,
      }),
    };

    const projectsTable = {
      select: jest.fn().mockReturnValueOnce(existingProjectQuery),
      update: jest.fn(),
    };

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "projects") return projectsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await saveProjectSubmission(supabase as never, {
      mode: "update",
      projectId,
      input: {
        projectName: "   ",
      },
    });

    expect(result).toMatchObject({
      code: "locked_field_missing",
      status: 400,
    });
    expect(projectsTable.update).not.toHaveBeenCalled();
  });
});

describe("saveProjectSubmission submission window", () => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const createdProjectId = "55555555-5555-4555-8555-555555555555";
  const pastCutoff = "2020-01-01T00:00:00.000Z";
  const futureStart = "2999-01-01T00:00:00.000Z";

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSubmissionFieldsByEventIds as jest.Mock).mockResolvedValue(new Map());
    (fetchSubmissionAnswersByProjectIds as jest.Mock).mockResolvedValue(
      new Map(),
    );
    (fetchArtifactsByProjectIds as jest.Mock).mockResolvedValue(new Map());
    (hydrateProjectsWithSubmissionData as jest.Mock).mockImplementation(
      (projects) => projects,
    );
  });

  function buildSupabase(event: {
    submission_time_start: string | null;
    submission_time_cutoff: string | null;
  }) {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: { event_id: eventId, event_name: "Demo Day", ...event },
        error: null,
      }),
    };
    const submissionFieldsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    const insertSelectQuery = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: { id: createdProjectId, contextus_project_id: "ctx-1" },
        error: null,
      }),
    };
    const updatedProjectQuery = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockResolvedValue({
        data: {
          id: createdProjectId,
          project_name: "Late Project",
          project_description: "Rescued",
          event_id: eventId,
          contextus_project_id: "ctx-1",
          submitted: true,
          project_tracks: [],
        },
        error: null,
      }),
    };
    const projectsTable = {
      insert: jest.fn().mockReturnValue(insertSelectQuery),
      select: jest.fn().mockReturnValue(updatedProjectQuery),
    };
    const artifactsTable = {
      delete: jest
        .fn()
        .mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") return eventsQuery;
        if (table === "event_submission_fields") return submissionFieldsQuery;
        if (table === "projects") return projectsTable;
        if (table === "project_artifacts") return artifactsTable;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    return { supabase, projectsTable };
  }

  const lateInput = {
    eventId,
    leadName: "Lead",
    leadEmail: "lead@example.com",
    projectName: "Late Project",
    projectDescription: "Rescued",
  };

  it("still rejects participant (default) submissions after the cutoff", async () => {
    const { supabase, projectsTable } = buildSupabase({
      submission_time_start: null,
      submission_time_cutoff: pastCutoff,
    });

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: lateInput,
      defaultSubmitted: true,
    });

    expect(result).toMatchObject({
      error: "Project submission deadline has passed",
      status: 400,
      submission_cutoff: pastCutoff,
    });
    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("allows the organizer on-behalf override to submit after the cutoff and flags it", async () => {
    const { supabase, projectsTable } = buildSupabase({
      submission_time_start: null,
      submission_time_cutoff: pastCutoff,
    });

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: lateInput,
      defaultSubmitted: true,
      overrides: ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES,
    });

    expect(result).toMatchObject({ status: 200, submittedAfterDeadline: true });
    expect(projectsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ submitted: true, event_id: eventId }),
    );
  });

  it("does not flag on-time submissions as late", async () => {
    const { supabase } = buildSupabase({
      submission_time_start: null,
      submission_time_cutoff: null,
    });

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: lateInput,
      overrides: ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES,
    });

    expect(result).toMatchObject({ status: 200, submittedAfterDeadline: false });
  });

  it("keeps enforcing the submission start even with the override", async () => {
    const { supabase, projectsTable } = buildSupabase({
      submission_time_start: futureStart,
      submission_time_cutoff: null,
    });

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: lateInput,
      overrides: ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES,
    });

    expect(result).toMatchObject({
      error: "Project submission has not started yet",
      status: 400,
    });
    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("cannot be enabled through request input", async () => {
    const { supabase, projectsTable } = buildSupabase({
      submission_time_start: null,
      submission_time_cutoff: pastCutoff,
    });

    const normalized = normalizeProjectWriteInput({
      event_id: eventId,
      lead_name: "Lead",
      project_name: "Late Project",
      project_description: "Rescued",
      allowAfterDeadline: true,
      overrides: { allowAfterDeadline: true },
    });
    expect(normalized.success).toBe(true);
    if (!normalized.success) return;
    expect(normalized.data).not.toHaveProperty("allowAfterDeadline");
    expect(normalized.data).not.toHaveProperty("overrides");

    const result = await saveProjectSubmission(supabase as never, {
      mode: "create",
      input: normalized.data,
      defaultSubmitted: true,
    });

    expect(result).toMatchObject({
      error: "Project submission deadline has passed",
      status: 400,
    });
    expect(projectsTable.insert).not.toHaveBeenCalled();
  });

  it("exposes a frozen override constant", () => {
    expect(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES).toEqual({
      allowAfterDeadline: true,
    });
    expect(Object.isFrozen(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES)).toBe(true);
  });
});
