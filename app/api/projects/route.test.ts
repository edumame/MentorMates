/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const project = {
  id: "project-1",
  project_name: "Rocket",
  lead_name: "Lea Lead",
  lead_email: "lead@example.com",
  teammates: ["mate@example.com"],
  event_id: "event-1",
  submitted: true,
  project_tracks: [],
};

const miaProfiles = {
  "mate@example.com": {
    display_name: "Mia Mate",
    avatar_url: "https://cdn.example.com/mia.png",
    affiliation: "State U",
  },
};

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "limit", "order"]) {
    query[method] = () => query;
  }
  query.single = () => query;
  query.maybeSingle = () => query;
  query.overrideTypes = () => query;
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function mockClients({
  user,
  visibility = "public",
}: {
  user: { id: string; email: string } | null;
  visibility?: string;
}) {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    from: (table: string) => {
      if (table === "projects") {
        return queryResult({ data: project, error: null });
      }
      if (table === "events") {
        return queryResult({ data: { visibility }, error: null });
      }
      return queryResult({ data: [], error: null });
    },
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  });

  const inFilter = jest.fn().mockResolvedValue({
    data: [
      {
        email: "mate@example.com",
        display_name: "Mia Mate",
        avatar_url: "https://cdn.example.com/mia.png",
        affiliation: "State U",
      },
    ],
    error: null,
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: (table: string) =>
      table === "user_profiles"
        ? { select: () => ({ in: inFilter }) }
        : queryResult({ data: [], error: null }),
  });
  return inFilter;
}

function getProject(query: string) {
  return GET(
    new NextRequest(`http://localhost/api/projects?projectId=project-1${query}`)
  );
}

describe("GET /api/projects team profiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves team profiles for logged-out viewers of a public project", async () => {
    const inFilter = mockClients({ user: null });

    const response = await getProject("&public=true");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(inFilter).toHaveBeenCalledWith("email", [
      "lead@example.com",
      "mate@example.com",
    ]);
    expect(body.project.team_profiles).toEqual(miaProfiles);
  });

  it("resolves team profiles on the authenticated project read", async () => {
    mockClients({ user: { id: "u1", email: "mate@example.com" } });

    const response = await getProject("");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.team_profiles).toEqual(miaProfiles);
  });

  it("does not resolve profiles for a project in a non-public event", async () => {
    const inFilter = mockClients({ user: null, visibility: "private" });

    const response = await getProject("&public=true");

    expect(response.status).toBe(404);
    expect(inFilter).not.toHaveBeenCalled();
  });
});
