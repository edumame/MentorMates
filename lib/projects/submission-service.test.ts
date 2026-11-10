import { saveProjectSubmission } from "./submission-service";
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

    const projectUpdateEq = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [{ id: "project-1" }], error: null }),
    });
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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

    const projectUpdateEq = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [{ id: "project-1" }], error: null }),
    });
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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
      rpc: jest.fn(async () => ({ data: [], error: null })),
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

  describe("project tracks when the event changes", () => {
    const newEventId = "55555555-5555-4555-8555-555555555555";
    const newEventTrackId = "66666666-6666-4666-8666-666666666666";
    const oldEventTrackId = "77777777-7777-4777-8777-777777777777";

    function buildSupabase(validTrackIds: string[] = []) {
      const existingProjectQuery = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        overrideTypes: jest.fn().mockResolvedValue({
          data: {
            id: projectId,
            event_id: eventId,
            contextus_project_id: "ctx-1",
            project_name: "Existing Name",
            project_description: "Existing Description",
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
            event_id: newEventId,
            contextus_project_id: "ctx-1",
            project_tracks: [],
          },
          error: null,
        }),
      };
      const projectsTable = {
        select: jest
          .fn()
          .mockReturnValueOnce(existingProjectQuery)
          .mockReturnValueOnce(updatedProjectQuery),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
      const eventsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        overrideTypes: jest.fn().mockResolvedValue({
          data: {
            event_id: newEventId,
            event_name: "Next Event",
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
        overrideTypes: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const eventTracksQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        overrideTypes: jest.fn().mockResolvedValue({
          data: validTrackIds.map((track_id) => ({ track_id })),
          error: null,
        }),
      };
      const deleteTracksEq = jest.fn().mockResolvedValue({ error: null });
      const projectTracksTable = {
        delete: jest.fn().mockReturnValue({ eq: deleteTracksEq }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
      const tables: Record<string, unknown> = {
        projects: projectsTable,
        events: eventsQuery,
        event_submission_fields: submissionFieldsQuery,
        event_tracks: eventTracksQuery,
        project_tracks: projectTracksTable,
      };
      const supabase = {
        from: jest.fn((table: string) => {
          if (!tables[table]) throw new Error(`Unexpected table ${table}`);
          return tables[table];
        }),
      };

      return { supabase, projectsTable, projectTracksTable, deleteTracksEq };
    }

    it("removes the old event's tracks when a project moves without trackIds", async () => {
      const { supabase, projectsTable, projectTracksTable, deleteTracksEq } =
        buildSupabase();

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { eventId: newEventId },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: newEventId }),
      );
      expect(projectTracksTable.delete).toHaveBeenCalledTimes(1);
      expect(deleteTracksEq).toHaveBeenCalledWith("project_id", projectId);
      expect(projectTracksTable.insert).not.toHaveBeenCalled();
    });

    it("reports an error when the old tracks cannot be removed", async () => {
      const { supabase, deleteTracksEq } = buildSupabase();
      deleteTracksEq.mockResolvedValue({ error: { message: "denied" } });
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { eventId: newEventId },
      });

      expect(result).toMatchObject({
        error: "Failed to update project tracks",
        status: 500,
      });
      consoleError.mockRestore();
    });

    it("replaces the tracks with the new event's tracks when trackIds are sent", async () => {
      const { supabase, projectTracksTable } = buildSupabase([newEventTrackId]);

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { eventId: newEventId, trackIds: [newEventTrackId] },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectTracksTable.delete).toHaveBeenCalledTimes(1);
      expect(projectTracksTable.insert).toHaveBeenCalledWith([
        { project_id: projectId, track_id: newEventTrackId },
      ]);
    });

    it("rejects a move that sends a track from the old event", async () => {
      const { supabase, projectsTable, projectTracksTable } = buildSupabase();

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { eventId: newEventId, trackIds: [oldEventTrackId] },
      });

      expect(result).toMatchObject({ status: 400 });
      expect(projectsTable.update).not.toHaveBeenCalled();
      expect(projectTracksTable.delete).not.toHaveBeenCalled();
    });

    it.each([
      ["resends the current event", { eventId, isPrivate: true }],
      ["does not send an event", { isPrivate: true }],
    ])("keeps the tracks when an update %s", async (_label, input) => {
      const { supabase, projectTracksTable } = buildSupabase();

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input,
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectTracksTable.delete).not.toHaveBeenCalled();
    });
  });
});
