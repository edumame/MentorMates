/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const EVENT_ID = "event-1";
const EARLY_ID = "11111111-1111-4111-8111-111111111111";
const LATE_ID = "22222222-2222-4222-8222-222222222222";

const scoreRow = (projectId: string, score: number) => ({
  project_id: projectId,
  scores: { overall: score },
  projects: { project_name: projectId, lead_name: "Lead", event_id: EVENT_ID },
});

// The late project's only score sits past the row cap.
const scoreRows = [
  ...Array.from({ length: 1100 }, () => scoreRow(EARLY_ID, 5)),
  scoreRow(LATE_ID, 9),
];

const eligibleProjects = [EARLY_ID, LATE_ID].map((id) => ({
  id,
  project_name: id,
  lead_name: "Lead",
}));

const supabaseMock = {
  auth: {
    getUser: async () => ({ data: { user: { id: "organizer" } }, error: null }),
  },
  from: (table: string) => {
    if (table === "project_scores") return cappedQuery(scoreRows);
    if (table === "projects") return cappedQuery(eligibleProjects);
    if (table === "project_round_advancements") return cappedQuery([]);
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { role: "organizer" },
              error: null,
            }),
          }),
        }),
      }),
    };
  },
};

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => supabaseMock),
}));

jest.mock("@/lib/judging/rounds", () => ({
  ...jest.requireActual("@/lib/judging/rounds"),
  getProjectIdsForRound: jest.fn(async () => [EARLY_ID, LATE_ID]),
}));

import { GET } from "./route";

describe("GET /api/events/[eventId]/rounds/advance", () => {
  it("ranks projects whose scores fall beyond the PostgREST row cap", async () => {
    const response = (await GET(
      new NextRequest(
        `http://localhost/api/events/${EVENT_ID}/rounds/advance?fromRound=1`
      ),
      { params: Promise.resolve({ eventId: EVENT_ID }) }
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.candidates[0]).toMatchObject({
      rank: 1,
      projectId: LATE_ID,
      judgeCount: 1,
    });
    expect(body.candidates[1]).toMatchObject({
      rank: 2,
      projectId: EARLY_ID,
      judgeCount: 1100,
    });
  });
});
