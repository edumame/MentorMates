/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "./route";

type Result = { data: unknown; error: unknown };
let tables: Record<string, Result>;
let roleResult: Result;
let queried: string[];

// Chainable query stub: every filter returns itself; awaiting resolves the table's result.
function query(result: Result) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in"]) chain[method] = () => chain;
  chain.maybeSingle = async () => result;
  chain.then = (resolve: (value: Result) => unknown) => resolve(result);
  return chain;
}

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "org" } }, error: null }) },
    rpc: async () => ({ data: false, error: null }),
    from: (table: string) => {
      queried.push(table);
      if (table === "user_event_roles") {
        // First call: caller's role (maybeSingle). Second: current scorers list.
        const chain = query(roleResult);
        (chain as { maybeSingle: () => Promise<Result> }).maybeSingle = async () => ({ data: { role: "organizer" }, error: null });
        return chain;
      }
      return query(tables[table] ?? { data: [], error: null });
    },
  }),
}));

const criteria = [
  { id: "impact", name: "Impact", description: "", type: "numeric", min: 1, max: 10, weight: 3 },
  { id: "polish", name: "Polish", description: "", type: "numeric", min: 1, max: 10, weight: 1 },
];
const scoreRow = (project_id: string, judge_id: string, scores: Record<string, unknown>, name: string) => ({
  project_id,
  judge_id,
  track_id: "t1",
  scores,
  projects: { project_name: name, lead_name: "Lead", event_id: "event" },
  event_tracks: { name: "Main" },
});

const context = { params: Promise.resolve({ eventId: "event" }) };
const get = () => new NextRequest("http://localhost/advance?fromRound=1");
// GET's inferred return type includes undefined (auth helper union); every path returns a response.
const run = async (request: NextRequest) => (await GET(request, context)) as Response;

beforeEach(() => {
  queried = [];
  roleResult = { data: [{ user_id: "j1" }, { user_id: "org" }], error: null };
  tables = {
    project_tracks: {
      data: [
        { project_id: "p1", track_id: "t1" },
        { project_id: "p2", track_id: "t1" },
        { project_id: "p3", track_id: "t1" },
      ],
      error: null,
    },
    project_round_advancements: { data: [], error: null },
    projects: {
      data: [
        { id: "p1", project_name: "Alpha", lead_name: "Lead" },
        { id: "p2", project_name: "Beta", lead_name: "Lead" },
        { id: "p3", project_name: "Gamma", lead_name: "Lead" },
      ],
      error: null,
    },
    project_scores: {
      data: [
        scoreRow("p1", "j1", { impact: 4, polish: 8 }, "Alpha"), // 10·(3·3/9 + 7/9)/4 = 40/9
        scoreRow("p1", "former", { impact: 10, polish: 10 }, "Alpha"), // ex-judge: excluded
        scoreRow("p2", "j1", { impact: 9999, polish: 6 }, "Beta"), // invalid scorecard -> not counted
        scoreRow("px", "j1", { impact: 10, polish: 10 }, "Ineligible"), // not eligible: excluded
      ],
      error: null,
    },
    event_tracks: { data: [{ track_id: "t1", name: "Main", scoring_criteria: { name: "Main", criteria } }], error: null },
    events: { data: { scoring_config: null }, error: null },
  };
});

it("ranks round candidates with the shared weighted score (JUDGE-007)", async () => {
  const response = await run(get());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.candidates).toEqual([
    // Lane C round 2: range-normalised 0-10 score; incomplete/invalid scorecards are not counted.
    { projectId: "p1", projectName: "Alpha", leadName: "Lead", score: expect.closeTo(40 / 9, 10), judgeCount: 1, rank: 1 },
    { rank: null, projectId: "p2", projectName: "Beta", leadName: "Lead", score: null, judgeCount: 0 },
    { rank: null, projectId: "p3", projectName: "Gamma", leadName: "Lead", score: null, judgeCount: 0 },
  ]);
});

it("counts every scorecard when the current-judge lookup fails", async () => {
  roleResult = { data: null, error: { message: "boom" } };
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const body = await (await run(get())).json();
  spy.mockRestore();
  expect(body.candidates[0]).toMatchObject({ projectId: "p1", score: expect.closeTo(65 / 9, 10), judgeCount: 2, rank: 1 });
});

it("fails with 500 when scores cannot be loaded", async () => {
  tables.project_scores = { data: null, error: { message: "boom" } };
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await run(get())).status).toBe(500);
  spy.mockRestore();
});

it("rejects an invalid fromRound", async () => {
  expect((await run(new NextRequest("http://localhost/advance?fromRound=1.5"))).status).toBe(400);
});

describe("scores for tracks a project has left", () => {
  const removedTrackRow = (project_id: string, name: string) => ({
    ...scoreRow(project_id, "j1", { impact: 10, polish: 10 }, name),
    track_id: "t-removed",
  });

  it("ignores them when ranking", async () => {
    tables.project_scores = {
      data: [
        scoreRow("p1", "j1", { impact: 4, polish: 8 }, "Alpha"),
        removedTrackRow("p1", "Alpha"), // must not raise p1's score
        removedTrackRow("p3", "Gamma"), // p3's only score is on a removed track
      ],
      error: null,
    };
    const body = await (await run(get())).json();
    expect(body.candidates).toEqual([
      { projectId: "p1", projectName: "Alpha", leadName: "Lead", score: expect.closeTo(40 / 9, 10), judgeCount: 1, rank: 1 },
      { rank: null, projectId: "p2", projectName: "Beta", leadName: "Lead", score: null, judgeCount: 0 },
      { rank: null, projectId: "p3", projectName: "Gamma", leadName: "Lead", score: null, judgeCount: 0 },
    ]);
  });

  it("fails rather than ranking on unknown track membership", async () => {
    tables.project_tracks = { data: null, error: { message: "boom" } };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect((await run(get())).status).toBe(500);
    spy.mockRestore();
  });

  it("does not query project_tracks when no project is eligible", async () => {
    tables.projects = { data: [], error: null };
    const response = await run(get());
    expect(response.status).toBe(200);
    expect(queried).not.toContain("project_tracks");
    expect((await response.json()).candidates).toEqual([]);
  });

});
