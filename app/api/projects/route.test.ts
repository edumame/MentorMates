/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "./route";

const mockCreateSupabaseClient = jest.fn();

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: () => mockCreateSupabaseClient(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => {
    throw new Error("service key not configured");
  },
}));

jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));

const projectRow = {
  id: "project-1",
  project_name: "Legacy Project",
  lead_name: "Lead Person",
  lead_email: "lead@example.com",
  project_description: "Submitted before configurable fields existed",
  teammates: [],
  project_url: "https://example.com/project",
  video_url: "https://example.com/demo-video",
  additional_materials_url: null,
  cover_image_url: null,
  event_id: "event-1",
  contextus_project_id: null,
  private: false,
  created_at: "2026-01-01T00:00:00.000Z",
  submitted: true,
  project_tracks: [],
};

function anonymousClient(rows: Record<string, unknown>) {
  const queryFor = (table: string) => {
    const result = { data: rows[table] ?? null, error: null };
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: [], error: null }),
    };
    for (const method of ["select", "eq", "in", "order"]) {
      query[method] = () => query;
    }
    query.maybeSingle = () => ({
      overrideTypes: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    });
    query.overrideTypes = () => Promise.resolve({ data: [], error: null });
    return query;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: queryFor,
  };
}

const request = (query: string) =>
  new NextRequest(`http://localhost/api/projects?${query}`);

describe("GET /api/projects for a logged-out visitor", () => {
  it("rejects the authenticated single-project request", async () => {
    mockCreateSupabaseClient.mockResolvedValue(anonymousClient({}));

    const response = await GET(request("projectId=project-1"));

    expect(response.status).toBe(401);
  });

  it("returns a project in a public event with its legacy video link", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      anonymousClient({
        projects: projectRow,
        events: { visibility: "public" },
      }),
    );

    const response = await GET(request("public=true&projectId=project-1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.project.project_name).toBe("Legacy Project");
    expect(payload.project.video_url).toBe("https://example.com/demo-video");
  });

  it("hides a project in a non-public event", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      anonymousClient({
        projects: projectRow,
        events: { visibility: "private" },
      }),
    );

    const response = await GET(request("public=true&projectId=project-1"));

    expect(response.status).toBe(404);
  });
});
