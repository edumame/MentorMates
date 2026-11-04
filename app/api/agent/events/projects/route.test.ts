/** @jest-environment jsdom */

import { GET } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createCappedQuery } from "@/lib/supabase/capped-query.test-helper";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private readonly body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(),
  authorizeAgentEventAccess: jest.fn(),
  requireScope: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const request = {
  nextUrl: new URL(
    "https://mentormates.ai/api/agent/events/projects?event_id=event-1&limit=200",
  ),
} as never;

function mockTables(scoresQuery: ReturnType<typeof createCappedQuery>) {
  const projects = Array.from({ length: 200 }, (_, index) => ({
    id: `project-${index}`,
  }));
  const projectsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest
      .fn()
      .mockResolvedValue({ data: projects, error: null, count: 200 }),
  };

  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "projects") return projectsQuery;
      if (table === "project_scores") return scoresQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });

  return projects;
}

describe("GET /api/agent/events/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (requireScope as jest.Mock).mockReturnValue(null);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({});
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      eventId: "event-1",
      scopes: ["projects:read"],
      keyId: "key-1",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("attaches every score when the event's scores exceed the row cap", async () => {
    const scores = Array.from({ length: 1200 }, (_, index) => ({
      id: `score-${index}`,
      project_id: `project-${index % 200}`,
      judge_id: `judge-${Math.floor(index / 200)}`,
    }));
    mockTables(createCappedQuery(scores));

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toHaveLength(200);
    for (const project of body.projects) {
      expect(project.scores).toHaveLength(6);
    }
  });

  it("returns an error instead of empty scores when the score query fails", async () => {
    mockTables(createCappedQuery([], { error: { message: "boom" } }));

    const response = await GET(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch project scores",
    });
  });
});
