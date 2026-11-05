/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/features/user/roles/roles", () => ({
  canAccessRole: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCanAccessRole = canAccessRole as jest.Mock;

type TableResult = { data: unknown; error: unknown };

function mockSupabase(tables: Record<string, TableResult>) {
  const selects: Record<string, string> = {};

  const from = (table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const builder = {
      select: (columns: string) => {
        selects[table] = columns;
        return builder;
      },
      eq: () => builder,
      in: () => builder,
      maybeSingle: () => Promise.resolve(result),
      then: (
        resolve: (value: TableResult) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  };

  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer" } },
        error: null,
      }),
    },
    from,
    rpc: jest.fn(),
  });

  return selects;
}

function criterion(id: string, weight: number) {
  return { id, name: id, description: "", weight };
}

function scoreRow(
  projectId: string,
  trackId: string | null,
  judgeId: string,
  scores: Record<string, unknown>
) {
  return {
    project_id: projectId,
    track_id: trackId,
    judge_id: judgeId,
    scores,
    projects: { project_name: projectId, lead_name: "", event_id: "event" },
  };
}

function eligibleProjects(...ids: string[]) {
  return {
    data: ids.map((id) => ({ id, project_name: id, lead_name: "" })),
    error: null,
  };
}

async function callGet(fromRound: number) {
  return (await GET(
    new NextRequest(
      `http://localhost/api/events/event/rounds/advance?fromRound=${fromRound}`
    ),
    { params: Promise.resolve({ eventId: "event" }) }
  )) as Response;
}

async function getCandidates(fromRound = 1) {
  const response = await callGet(fromRound);
  expect(response.status).toBe(200);
  return (await response.json()).candidates as Array<{
    projectId: string;
    rank: number | null;
    score: number | null;
    judgeCount: number;
  }>;
}

describe("GET /api/events/[eventId]/rounds/advance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessRole.mockReturnValue(true);
  });

  it("ranks with the track rubric's weights and counts distinct judges", async () => {
    const criteria = [criterion("tech", 3), criterion("design", 1)];
    const selects = mockSupabase({
      user_event_roles: { data: { role: "organizer" }, error: null },
      projects: eligibleProjects("a", "b"),
      events: {
        data: {
          scoring_config: null,
          event_tracks: [
            {
              track_id: "t1",
              name: "Main",
              scoring_criteria: { name: "Main", criteria },
            },
            {
              track_id: "t2",
              name: "Side",
              scoring_criteria: { name: "Side", criteria },
            },
          ],
        },
        error: null,
      },
      project_scores: {
        data: [
          scoreRow("a", "t1", "j1", { tech: 10, design: 2 }),
          scoreRow("a", "t2", "j1", { tech: 10, design: 2 }),
          scoreRow("b", "t1", "j1", { tech: 6, design: 8 }),
        ],
        error: null,
      },
    });

    const candidates = await getCandidates();

    expect(selects.project_scores).toEqual(expect.stringContaining("track_id"));
    expect(selects.project_scores).toEqual(expect.stringContaining("judge_id"));
    expect(candidates).toEqual([
      expect.objectContaining({ projectId: "a", rank: 1, score: 32, judgeCount: 1 }),
      expect.objectContaining({ projectId: "b", rank: 2, score: 26, judgeCount: 1 }),
    ]);
  });

  it("uses the rubric of the round being advanced from", async () => {
    mockSupabase({
      user_event_roles: { data: { role: "organizer" }, error: null },
      project_round_advancements: {
        data: [{ project_id: "a" }],
        error: null,
      },
      projects: eligibleProjects("a"),
      events: {
        data: {
          scoring_config: {
            tracks: {},
            rounds: [
              { round_number: 1, name: "Round 1" },
              {
                round_number: 2,
                name: "Round 2",
                criteria: [criterion("finals", 2)],
              },
            ],
          },
          event_tracks: [
            {
              track_id: "t1",
              name: "Main",
              scoring_criteria: {
                name: "Main",
                criteria: [criterion("tech", 1)],
              },
            },
          ],
        },
        error: null,
      },
      project_scores: {
        data: [scoreRow("a", "t1", "j1", { finals: 4, tech: 10 })],
        error: null,
      },
    });

    const candidates = await getCandidates(2);

    expect(candidates[0]).toMatchObject({ projectId: "a", score: 8 });
  });

  it("leaves a project unranked when its score has no track", async () => {
    mockSupabase({
      user_event_roles: { data: { role: "organizer" }, error: null },
      projects: eligibleProjects("a"),
      events: {
        data: {
          scoring_config: null,
          event_tracks: [
            {
              track_id: "t1",
              name: "Main",
              scoring_criteria: {
                name: "Main",
                criteria: [criterion("tech", 1)],
              },
            },
          ],
        },
        error: null,
      },
      project_scores: {
        data: [scoreRow("a", null, "j1", { tech: 9 })],
        error: null,
      },
    });

    const candidates = await getCandidates();

    expect(candidates).toEqual([
      expect.objectContaining({
        projectId: "a",
        rank: null,
        score: null,
        judgeCount: 0,
      }),
    ]);
  });

  it("returns 500 when the event's rubric cannot be loaded", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSupabase({
      user_event_roles: { data: { role: "organizer" }, error: null },
      projects: eligibleProjects("a"),
      events: { data: null, error: new Error("boom") },
    });

    const response = await callGet(1);

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
