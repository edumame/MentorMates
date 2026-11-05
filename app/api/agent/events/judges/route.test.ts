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
    "https://mentormates.ai/api/agent/events/judges?event_id=event-1",
  ),
} as never;

function mockTables(scoresQuery: ReturnType<typeof createCappedQuery>) {
  const rolesQuery = createCappedQuery([
    { user_id: "judge-1", role: "judge" },
    { user_id: "judge-2", role: "judge" },
  ]);
  const projectsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ count: 800, error: null }),
  };

  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") return rolesQuery;
      if (table === "projects") return projectsQuery;
      if (table === "project_scores") return scoresQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
}

describe("GET /api/agent/events/judges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (requireScope as jest.Mock).mockReturnValue(null);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({});
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      eventId: "event-1",
      scopes: ["participants:read"],
      keyId: "key-1",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("counts every score when the judges' scores exceed the row cap", async () => {
    const scores = [
      ...Array.from({ length: 700 }, () => ({ judge_id: "judge-1" })),
      ...Array.from({ length: 600 }, () => ({ judge_id: "judge-2" })),
    ];
    mockTables(createCappedQuery(scores));

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.judges.map((judge: { projects_scored: number }) => judge.projects_scored),
    ).toEqual([700, 600]);
  });

  it("returns an error instead of zero progress when the score query fails", async () => {
    mockTables(createCappedQuery([], { error: { message: "boom" } }));

    const response = await GET(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch judge scores",
    });
  });
});
