/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DELETE, PATCH } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/projects/access", () => ({
  getProjectEditAccess: jest.fn(),
}));

jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));

jest.mock("@/lib/projects/query", () => ({
  fetchArtifactsByProjectIds: jest.fn().mockResolvedValue(new Map()),
  fetchSubmissionAnswersByProjectIds: jest.fn().mockResolvedValue(new Map()),
  fetchSubmissionFieldsByEventIds: jest.fn().mockResolvedValue(new Map()),
  hydrateProjectsWithSubmissionData: jest.fn((projects) => projects),
}));

const projectId = "22222222-2222-4222-8222-222222222222";
const sourceEventId = "11111111-1111-4111-8111-111111111111";
const targetEventId = "55555555-5555-4555-8555-555555555555";

type QueryResult = { data: unknown; error: unknown };

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

describe("PATCH /api/projects/[projectId]", () => {
  const projectRow = {
    id: projectId,
    event_id: sourceEventId,
    contextus_project_id: "ctx-1",
    project_name: "Existing Name",
    project_description: "Existing Description",
    submitted: true,
  };

  const projectUpdate = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (getProjectEditAccess as jest.Mock).mockResolvedValue({
      access: { canEdit: true },
      error: null,
      status: 200,
    });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "lead@example.com" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "projects") {
          return {
            select: jest.fn(() =>
              query({
                data: { ...projectRow, project_tracks: [] },
                error: null,
              }),
            ),
            update: projectUpdate,
          };
        }
        if (table === "events") {
          return query({
            data: {
              event_id: targetEventId,
              event_name: "Target Event",
              submission_time_start: null,
              submission_time_cutoff: "2999-01-01T00:00:00.000Z",
            },
            error: null,
          });
        }
        if (table === "event_submission_fields") {
          return query({ data: [], error: null });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "events") {
          return query({
            data: { submission_time_cutoff: "2020-01-01T00:00:00.000Z" },
            error: null,
          });
        }
        return query({
          data: table === "project_scores" ? [{ project_id: projectId }] : [],
          error: null,
        });
      }),
    });
  });

  it("returns 409 and leaves the project alone when it is moved out of a closed, scored event", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ event_id: targetEventId }),
      }),
      { params: Promise.resolve({ projectId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "project_event_move_blocked",
      error: expect.any(String),
    });
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/projects/[projectId]", () => {
  type Access = {
    eventId: string | null;
    isLead: boolean;
    isTeammate: boolean;
    isOrganizer: boolean;
    canEdit: boolean;
  };

  const userClientFrom = jest.fn();
  let deleteBuilder: {
    delete: jest.Mock;
    eq: jest.Mock;
    select: jest.Mock;
  };
  let serviceFrom: jest.Mock;

  function signedIn(user: { id: string; email: string } | null = { id: "user-1", email: "lead@x.com" }) {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user },
          error: user ? null : { message: "no session" },
        }),
      },
      from: userClientFrom,
    });
  }

  function access(overrides: Partial<Access> | null) {
    (getProjectEditAccess as jest.Mock).mockResolvedValue(
      overrides === null
        ? { access: null, error: "Project not found", status: 404 }
        : {
            access: {
              eventId: sourceEventId,
              isLead: true,
              isTeammate: false,
              isOrganizer: false,
              canEdit: true,
              ...overrides,
            },
            error: null,
            status: 200,
          },
    );
  }

  function deleteResult(result: { data: unknown; error: unknown }) {
    deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(result),
    };
    serviceFrom = jest.fn((table: string) => {
      if (table === "projects") return deleteBuilder;
      throw new Error(`Unexpected table ${table}`);
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from: serviceFrom });
  }

  const remove = () =>
    DELETE(new NextRequest(`http://localhost/api/projects/${projectId}`, { method: "DELETE" }), {
      params: Promise.resolve({ projectId }),
    });

  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
    access({});
    deleteResult({ data: [{ id: projectId }], error: null });
  });

  it("rejects a signed-out caller", async () => {
    signedIn(null);

    const response = await remove();

    expect(response.status).toBe(401);
    expect(deleteBuilder.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown project", async () => {
    access(null);

    const response = await remove();

    expect(response.status).toBe(404);
    expect(deleteBuilder.delete).not.toHaveBeenCalled();
  });

  it("lets the lead delete their own project", async () => {
    const response = await remove();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", projectId);
  });

  it("does not block the lead on a submitted project", async () => {
    // The route no longer reads `submitted`: leads may delete their own
    // project whether or not it was submitted.
    const response = await remove();

    expect(response.status).toBe(200);
    expect(userClientFrom).not.toHaveBeenCalled();
  });

  it("lets an organizer of the event delete any of its projects", async () => {
    access({ isLead: false, isOrganizer: true });

    const response = await remove();

    expect(response.status).toBe(200);
  });

  it("does not let a teammate delete the project", async () => {
    access({ isLead: false, isTeammate: true, canEdit: true });

    const response = await remove();

    expect(response.status).toBe(403);
    expect(deleteBuilder.delete).not.toHaveBeenCalled();
  });

  it("does not let an unrelated user delete the project", async () => {
    access({ isLead: false, canEdit: false });

    const response = await remove();

    expect(response.status).toBe(403);
    expect(deleteBuilder.delete).not.toHaveBeenCalled();
  });

  it("deletes only the project row and leaves related rows to the cascades", async () => {
    await remove();

    expect(serviceFrom.mock.calls.map(([table]) => table)).toEqual(["projects"]);
  });

  it("reports a failed delete without leaking the database message", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    deleteResult({ data: null, error: { message: "violates foreign key constraint" } });

    const response = await remove();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to delete project" });
    errorSpy.mockRestore();
  });

  it("returns 404 when nothing was deleted", async () => {
    deleteResult({ data: [], error: null });

    const response = await remove();

    expect(response.status).toBe(404);
  });
});
