import { saveProjectSubmission } from "./submission-service";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
  fetchSubmissionFieldsByEventIds,
  hydrateProjectsWithSubmissionData,
} from "@/lib/projects/query";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

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

  describe("project lead on update", () => {
    const buildUpdateSupabase = (contextusProjectId: string | null) => {
      const existingProjectQuery = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        overrideTypes: jest.fn().mockResolvedValue({
          data: {
            id: projectId,
            event_id: null,
            contextus_project_id: contextusProjectId,
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
            project_name: "Existing Name",
            lead_name: "Real Lead",
            lead_email: "lead@example.com",
            project_description: "Existing Description",
            teammates: ["teammate@example.com"],
            project_url: null,
            video_url: null,
            additional_materials_url: null,
            cover_image_url: null,
            event_id: null,
            contextus_project_id: contextusProjectId,
            private: false,
            created_at: "2026-04-16T12:00:00.000Z",
            submitted: true,
            submitted_at: "2026-04-16T12:00:00.000Z",
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
          eq: jest.fn().mockReturnValue({
            select: jest
              .fn()
              .mockResolvedValue({ data: [{ id: projectId }], error: null }),
          }),
        }),
      };
      const supabase = {
        // project_team_emails is the source of the stored lead.
        rpc: jest.fn(async () => ({
          data: [
            {
              project_id: projectId,
              lead_email: "lead@example.com",
              teammates: ["teammate@example.com"],
            },
          ],
          error: null,
        })),
        from: jest.fn((table: string) => {
          if (table === "projects") return projectsTable;
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      return { supabase, projectsTable };
    };

    it("does not write lead_email, even when the input carries one", async () => {
      const { supabase, projectsTable } = buildUpdateSupabase("ctx-1");

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { leadEmail: "teammate@example.com", submitted: true },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledTimes(1);
      expect(projectsTable.update.mock.calls[0][0]).toMatchObject({
        submitted: true,
      });
      expect(projectsTable.update.mock.calls[0][0]).not.toHaveProperty(
        "lead_email",
      );
    });

    it("reports the stored lead to Contextus, not the input lead", async () => {
      const { supabase } = buildUpdateSupabase(null);
      (createContextusProject as jest.Mock).mockResolvedValue("ctx-new");

      await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { leadEmail: "teammate@example.com", submitted: true },
      });

      expect(createContextusProject).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            team_lead_email: "lead@example.com",
          }),
        }),
      );
    });
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

  describe("team changes", () => {
    async function saveTeamChanges(input: {
      addTeammates?: string[];
      removeTeammates?: string[];
    }) {
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
            teammates: ["joined@x.com", "gone@x.com"],
          },
          error: null,
        }),
      };
      const projectsTable = {
        select: jest.fn().mockReturnValue(existingProjectQuery),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest
              .fn()
              .mockResolvedValue({ data: [{ id: projectId }], error: null }),
          }),
        }),
      };
      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "projects") return projectsTable;
          throw new Error(`Unexpected table ${table}`);
        }),
        rpc: jest.fn(async () => ({ data: [], error: null })),
      };

      await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { projectName: "Renamed", ...input },
      });

      return projectsTable.update.mock.calls[0][0];
    }

    it("applies changes to the stored team, keeping people who joined by invite", async () => {
      const update = await saveTeamChanges({
        addTeammates: ["pat@x.com"],
        removeTeammates: ["gone@x.com"],
      });

      expect(update.teammates).toEqual(["joined@x.com", "pat@x.com"]);
    });

    it("leaves the team alone when there is nothing to change", async () => {
      const update = await saveTeamChanges({
        addTeammates: [],
        removeTeammates: [],
      });

      expect(update).not.toHaveProperty("teammates");
    });
  });

  describe("moving a project to another event", () => {
    const targetEventId = "55555555-5555-4555-8555-555555555555";
    const pastCutoff = "2020-01-01T00:00:00.000Z";
    const futureCutoff = "2999-01-01T00:00:00.000Z";

    type QueryResult = { data: unknown; error: unknown };

    // Every builder method chains; awaiting or calling overrideTypes resolves.
    const query = (result: QueryResult) => {
      const builder: Record<string, unknown> = {
        then: (
          resolve: (value: QueryResult) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
        overrideTypes: jest.fn().mockResolvedValue(result),
      };
      for (const method of ["select", "eq", "order", "limit", "single", "maybeSingle"]) {
        builder[method] = jest.fn().mockReturnValue(builder);
      }
      return builder;
    };

    const setup = ({
      submitted = true,
      sourceEventId = eventId,
      sourceCutoff = futureCutoff,
      sourceEventError = null,
      judgingRows = {},
      judgingError = null,
    }: {
      submitted?: boolean | null;
      sourceEventId?: string | null;
      sourceCutoff?: string | null;
      sourceEventError?: unknown;
      judgingRows?: Record<string, unknown[]>;
      judgingError?: unknown;
    } = {}) => {
      const projectRow = {
        id: projectId,
        event_id: sourceEventId,
        contextus_project_id: "ctx-1",
        project_name: "Existing Name",
        project_description: "Existing Description",
        submitted,
      };
      const projectsTable = {
        select: jest
          .fn()
          .mockReturnValueOnce(query({ data: projectRow, error: null }))
          .mockReturnValueOnce(
            query({
              data: { ...projectRow, event_id: targetEventId, project_tracks: [] },
              error: null,
            }),
          ),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest
              .fn()
              .mockResolvedValue({ data: [{ id: projectId }], error: null }),
          }),
        }),
      };

      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "projects") return projectsTable;
          if (table === "events") {
            return query({
              data: {
                event_id: targetEventId,
                event_name: "Target Event",
                submission_time_start: null,
                submission_time_cutoff: futureCutoff,
              },
              error: null,
            });
          }
          if (table === "event_submission_fields") {
            return query({ data: [], error: null });
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        rpc: jest.fn(async () => ({ data: [], error: null })),
      };

      // Advancements are hidden from leads by RLS, so the guard has
      // to see them through the service client. The caller's client above
      // throws on those tables to prove it never relies on them.
      const serviceClient = {
        from: jest.fn((table: string) => {
          if (table === "events") {
            return query({
              data: sourceEventError
                ? null
                : { submission_time_cutoff: sourceCutoff },
              error: sourceEventError,
            });
          }
          return query({
            data: judgingError ? null : (judgingRows[table] ?? []),
            error: judgingError,
          });
        }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue(serviceClient);

      const move = (eventIdInput: string = targetEventId) =>
        saveProjectSubmission(supabase as never, {
          mode: "update",
          projectId,
          input: { eventId: eventIdInput },
        });

      return { move, projectsTable, serviceClient };
    };

    it("rejects the move once the current event's cutoff has passed", async () => {
      const { move, projectsTable } = setup({ sourceCutoff: pastCutoff });

      await expect(move()).resolves.toMatchObject({
        code: "project_event_move_blocked",
        status: 409,
      });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("rejects the move when the cutoff has passed and advancements exist", async () => {
      const { move, projectsTable } = setup({
        sourceCutoff: pastCutoff,
        judgingRows: { project_round_advancements: [{ project_id: projectId }] },
      });

      await expect(move()).resolves.toMatchObject({ status: 409 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("rejects the move while the window is open if the project advanced a round", async () => {
      const { move, projectsTable } = setup({
        judgingRows: { project_round_advancements: [{ project_id: projectId }] },
      });

      await expect(move()).resolves.toMatchObject({
        code: "project_event_move_blocked",
        status: 409,
      });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("leaves scores and assignments to the database triggers", async () => {
      // guard_project_event_change refuses scored projects (23514) and
      // cleanup_project_after_event_change drops stale assignments.
      const { move, serviceClient } = setup({
        judgingRows: {
          project_scores: [{ project_id: projectId }],
          project_assignments: [{ project_id: projectId }],
        },
      });

      await expect(move()).resolves.toMatchObject({ status: 200 });
      const tables = serviceClient.from.mock.calls.map(([table]) => table);
      expect(tables).not.toContain("project_scores");
      expect(tables).not.toContain("project_assignments");
    });

    it("rejects a draft that already has judging records", async () => {
      const { move, projectsTable } = setup({
        submitted: false,
        sourceCutoff: pastCutoff,
        judgingRows: { project_round_advancements: [{ project_id: projectId }] },
      });

      await expect(move()).resolves.toMatchObject({ status: 409 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("treats a legacy project with unknown submitted state as submitted", async () => {
      const { move, projectsTable } = setup({
        submitted: null,
        sourceCutoff: pastCutoff,
      });

      await expect(move()).resolves.toMatchObject({ status: 409 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("fails closed when the current event cannot be read", async () => {
      const { move, projectsTable } = setup({
        sourceEventError: { message: "boom" },
      });

      await expect(move()).resolves.toMatchObject({ status: 500 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("fails closed when judging records cannot be read", async () => {
      const { move, projectsTable } = setup({
        judgingError: { message: "boom" },
      });

      await expect(move()).resolves.toMatchObject({ status: 500 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("fails closed when the service client is unavailable", async () => {
      const { move, projectsTable } = setup();
      (createSupabaseServiceClient as jest.Mock).mockImplementation(() => {
        throw new Error("supabaseKey is required.");
      });

      await expect(move()).resolves.toMatchObject({ status: 500 });
      expect(projectsTable.update).not.toHaveBeenCalled();
    });

    it("still moves a project whose window is open and has no judging records", async () => {
      const { move, projectsTable } = setup();

      await expect(move()).resolves.toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: targetEventId }),
      );
    });

    it("still lets an unsubmitted draft leave a closed event", async () => {
      const { move, projectsTable } = setup({
        submitted: false,
        sourceCutoff: pastCutoff,
      });

      await expect(move()).resolves.toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: targetEventId }),
      );
    });

    it("does not guard a project that has no current event", async () => {
      const { move, projectsTable, serviceClient } = setup({
        sourceEventId: null,
      });

      await expect(move()).resolves.toMatchObject({ status: 200 });
      expect(serviceClient.from).not.toHaveBeenCalled();
      expect(projectsTable.update).toHaveBeenCalled();
    });

    it("does not guard an update that resends the current event", async () => {
      const { move, serviceClient } = setup({
        judgingRows: { project_scores: [{ project_id: projectId }] },
      });

      await expect(move(eventId)).resolves.toMatchObject({ status: 200 });
      expect(serviceClient.from).not.toHaveBeenCalled();
    });
  });

  describe("locked fields on existing projects", () => {
    function buildUpdateSupabase(existingProject: {
      project_name: string | null;
      project_description: string | null;
      submitted: boolean | null;
      project_url?: string | null;
    }) {
      const buildProjectRowQuery = (data: Record<string, unknown>) => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        overrideTypes: jest.fn().mockResolvedValue({ data, error: null }),
      });
      const row = {
        id: projectId,
        event_id: null,
        contextus_project_id: null,
        ...existingProject,
      };
      const projectsTable = {
        select: jest
          .fn()
          .mockReturnValueOnce(buildProjectRowQuery(row))
          .mockReturnValueOnce(
            buildProjectRowQuery({ ...row, project_tracks: [] }),
          ),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest
              .fn()
              .mockResolvedValue({ data: [{ id: projectId }], error: null }),
          }),
        }),
      };
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
        overrideTypes: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "projects") return projectsTable;
          if (table === "events") return eventsQuery;
          if (table === "event_submission_fields") {
            return submissionFieldsQuery;
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        rpc: jest.fn(async () => ({ data: [], error: null })),
      };

      return { projectsTable, supabase };
    }

    const emptyDraft = {
      project_name: null,
      project_description: null,
      submitted: false,
    };

    it("saves a draft with only a name", async () => {
      const { projectsTable, supabase } = buildUpdateSupabase(emptyDraft);

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { projectName: "Only a name" },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ project_name: "Only a name" }),
      );
    });

    it("saves a draft with only a description", async () => {
      const { projectsTable, supabase } = buildUpdateSupabase(emptyDraft);

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { projectDescription: "Only a description" },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ project_description: "Only a description" }),
      );
    });

    it("saves an event change on a draft with no name or description", async () => {
      const { projectsTable, supabase } = buildUpdateSupabase(emptyDraft);

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { eventId },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: eventId }),
      );
    });

    it("lets a draft clear a field it already saved", async () => {
      const { projectsTable, supabase } = buildUpdateSupabase({
        project_name: "Old name",
        project_description: null,
        submitted: false,
      });

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { projectName: "" },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(projectsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ project_name: "" }),
      );
    });

    it("does not create a Contextus project while saving a draft", async () => {
      const { supabase } = buildUpdateSupabase(emptyDraft);

      await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { projectName: "Only a name" },
      });

      expect(createContextusProject).not.toHaveBeenCalled();
    });

    it("creates the Contextus project from saved values when a draft is published", async () => {
      (createContextusProject as jest.Mock).mockResolvedValue("ctx-new");
      const { supabase } = buildUpdateSupabase({
        project_name: "Saved name",
        project_description: "Saved description",
        submitted: false,
      });

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { submitted: true },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(createContextusProject).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Saved name",
          artifacts: { type: "doc", title: "Saved description" },
        }),
      );
    });

    it("keeps the saved repository link when a draft is published with only the submitted flag", async () => {
      (createContextusProject as jest.Mock).mockResolvedValue("ctx-new");
      const { supabase } = buildUpdateSupabase({
        project_name: "Saved name",
        project_description: "Saved description",
        project_url: "https://github.com/a/b",
        submitted: false,
      });

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { submitted: true },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(createContextusProject).toHaveBeenCalledWith(
        expect.objectContaining({
          artifacts: {
            type: "link",
            title: "Project Repository",
            url: "https://github.com/a/b",
          },
        }),
      );
    });

    it("prefers the repository link in the request over the saved one on publish", async () => {
      (createContextusProject as jest.Mock).mockResolvedValue("ctx-new");
      const { supabase } = buildUpdateSupabase({
        project_name: "Saved name",
        project_description: "Saved description",
        project_url: "https://github.com/a/old",
        submitted: false,
      });

      const result = await saveProjectSubmission(supabase as never, {
        mode: "update",
        projectId,
        input: { submitted: true, projectUrl: "https://github.com/a/new" },
      });

      expect(result).toMatchObject({ status: 200 });
      expect(createContextusProject).toHaveBeenCalledWith(
        expect.objectContaining({
          artifacts: expect.objectContaining({
            type: "link",
            url: "https://github.com/a/new",
          }),
        }),
      );
    });

    it.each([
      ["an explicit submitted flag", { submitted: true }, undefined],
      ["the submit route default", {}, true],
    ])(
      "rejects publishing an incomplete draft via %s",
      async (_label, submittedInput, defaultSubmitted) => {
        const { projectsTable, supabase } = buildUpdateSupabase(emptyDraft);

        const result = await saveProjectSubmission(supabase as never, {
          mode: "update",
          projectId,
          defaultSubmitted,
          input: { projectName: "Only a name", ...submittedInput },
        });

        expect(result).toMatchObject({
          code: "locked_field_missing",
          status: 400,
          error: expect.stringContaining("project_description"),
        });
        expect(projectsTable.update).not.toHaveBeenCalled();
      },
    );

    it.each([[true], [null]])(
      "rejects an update that leaves a required field empty when submitted is %s",
      async (submitted) => {
        const { projectsTable, supabase } = buildUpdateSupabase({
          project_name: "Existing name",
          project_description: null,
          submitted,
        });

        const result = await saveProjectSubmission(supabase as never, {
          mode: "update",
          projectId,
          input: { projectName: "New name" },
        });

        expect(result).toMatchObject({
          code: "locked_field_missing",
          status: 400,
        });
        expect(projectsTable.update).not.toHaveBeenCalled();
      },
    );

    it("rejects create with submitted false and no description", async () => {
      const projectsTable = { insert: jest.fn() };
      const supabase = {
        from: jest.fn((table: string) => {
          if (table === "projects") return projectsTable;
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      const result = await saveProjectSubmission(supabase as never, {
        mode: "create",
        input: { leadName: "Lead", projectName: "A", submitted: false },
      });

      expect(result).toMatchObject({
        code: "locked_field_missing",
        status: 400,
      });
      expect(projectsTable.insert).not.toHaveBeenCalled();
    });
  });
});
