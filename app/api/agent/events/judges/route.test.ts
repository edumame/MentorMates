/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const judgeRows = ["judge-1", "judge-2"].map((user_id) => ({
  user_id,
  role: "judge",
  user_profiles: null,
}));

// judge-2's rows all sit past the row cap, so a single select never sees them.
const scoreRows = [
  ...Array.from({ length: 1000 }, () => ({ judge_id: "judge-1" })),
  ...Array.from({ length: 200 }, () => ({ judge_id: "judge-2" })),
];

const serviceMock = {
  from: (table: string) => {
    if (table === "user_event_roles") return cappedQuery(judgeRows);
    if (table === "project_scores") return cappedQuery(scoreRows);
    return cappedQuery([]);
  },
};

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(async () => ({ eventId: "event-1" })),
  authorizeAgentEventAccess: jest.fn(async () => ({})),
  requireScope: jest.fn(() => null),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => serviceMock,
}));

import { GET } from "./route";

describe("GET /api/agent/events/judges", () => {
  it("counts every score row beyond the PostgREST row cap", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/agent/events/judges")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.judges.map((judge: { projects_scored: number }) => judge.projects_scored)
    ).toEqual([1000, 200]);
  });
});
