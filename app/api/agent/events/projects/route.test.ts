/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { cappedQuery } from "@/lib/supabase/capped-query.test-helper";

const projectRows = [{ id: "project-1" }, { id: "project-2" }];

const scoreRow = (project_id: string, index: number) => ({
  project_id,
  scores: {},
  comments: null,
  judge_id: `judge-${index}`,
  finalist_recommendation: project_id === "project-2",
});

// project-2's rows all sit past the row cap, so a single select never sees them.
const scoreRows = [
  ...Array.from({ length: 1000 }, (_, index) => scoreRow("project-1", index)),
  ...Array.from({ length: 200 }, (_, index) => scoreRow("project-2", index)),
];

const serviceMock = {
  from: (table: string) =>
    table === "projects" ? cappedQuery(projectRows) : cappedQuery(scoreRows),
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

describe("GET /api/agent/events/projects", () => {
  it("attaches scores that sit beyond the PostgREST row cap", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/agent/events/projects")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const [first, second] = body.projects;
    expect(first.scores).toHaveLength(1000);
    expect(second.scores).toHaveLength(200);
    expect(
      second.scores.every(
        (score: { finalist_recommendation: boolean }) =>
          score.finalist_recommendation
      )
    ).toBe(true);
  });
});
