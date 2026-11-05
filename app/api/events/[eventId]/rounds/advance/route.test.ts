/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

type QueryResult = { data: unknown; error: unknown };

function queryBuilder(result: QueryResult) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  };
}

const projects = [
  { id: "p-mixed", project_name: "Mixed", lead_name: "Mia" },
  { id: "p-stale", project_name: "Stale", lead_name: "Sam" },
];

const scoreRow = (projectId: string, trackId: string, score: number) => ({
  project_id: projectId,
  track_id: trackId,
  scores: { impact: score },
  projects: {
    project_name: projects.find((project) => project.id === projectId)
      ?.project_name,
    lead_name: projects.find((project) => project.id === projectId)?.lead_name,
    event_id: "event-1",
  },
});

function mockSupabase(tables: Partial<Record<string, QueryResult>>) {
  const builders: Record<string, ReturnType<typeof queryBuilder>> = {};
  const results: Record<string, QueryResult> = {
    user_event_roles: { data: { role: "organizer" }, error: null },
    project_round_advancements: { data: [], error: null },
    projects: { data: projects, error: null },
    project_scores: { data: [], error: null },
    project_tracks: { data: [], error: null },
    ...tables,
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer-1" } },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
    from: jest.fn((table: string) => {
      builders[table] = queryBuilder(results[table]);
      return builders[table];
    }),
  });

  return builders;
}

const getCandidates = async () =>
  (await GET(
    new NextRequest(
      "http://localhost/api/events/event-1/rounds/advance?fromRound=1"
    ),
    { params: Promise.resolve({ eventId: "event-1" }) }
  )) as Response;

describe("GET /api/events/[eventId]/rounds/advance", () => {
  it("ignores scores for tracks a project has left", async () => {
    const builders = mockSupabase({
      project_scores: {
        data: [
          scoreRow("p-mixed", "track-a", 6),
          scoreRow("p-mixed", "track-b", 10),
          scoreRow("p-stale", "track-b", 9),
        ],
        error: null,
      },
      project_tracks: {
        data: [
          { project_id: "p-mixed", track_id: "track-a" },
          { project_id: "p-stale", track_id: "track-a" },
        ],
        error: null,
      },
    });

    const response = await getCandidates();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(builders.project_tracks.in).toHaveBeenCalledWith("project_id", [
      "p-mixed",
      "p-stale",
    ]);
    expect(body.candidates).toEqual([
      {
        rank: 1,
        projectId: "p-mixed",
        projectName: "Mixed",
        leadName: "Mia",
        score: 6,
        judgeCount: 1,
      },
      {
        rank: null,
        projectId: "p-stale",
        projectName: "Stale",
        leadName: "Sam",
        score: null,
        judgeCount: 0,
      },
    ]);
  });

  it("fails rather than ranking on unknown track membership", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSupabase({
      project_tracks: { data: null, error: new Error("query failed") },
    });

    const response = await getCandidates();

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });

  it("does not query project_tracks when no project is eligible", async () => {
    const builders = mockSupabase({ projects: { data: [], error: null } });

    const response = await getCandidates();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(builders.project_tracks).toBeUndefined();
    expect(body.candidates).toEqual([]);
  });
});
