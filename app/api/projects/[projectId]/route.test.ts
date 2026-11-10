/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { PATCH } from "./route";

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
