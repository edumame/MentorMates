/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const USER = { id: "user-123", email: "lead@example.com" };
const UNDEFINED_COLUMN = { code: "42703", message: "column does not exist" };

type QueryResult = { data: { id: string }[] | null; error: unknown };

function mockSupabase({
  user = USER,
  projects = { data: [{ id: "project-1" }, { id: "project-2" }], error: null },
  feedback = { data: [{ id: "feedback-1" }, { id: "feedback-2" }], error: null },
  upsertError = null,
}: {
  user?: { id: string; email?: string } | null;
  projects?: QueryResult;
  feedback?: QueryResult;
  upsertError?: unknown;
} = {}) {
  // Behaves like PostgREST: a filter on a column projects does not have is
  // rejected with an error result rather than a thrown exception.
  const projectsOr = jest.fn(async (filter: string) =>
    /owner_id|team_members/.test(filter)
      ? { data: null, error: UNDEFINED_COLUMN }
      : projects,
  );
  const feedbackIn = jest.fn().mockResolvedValue(feedback);
  const upsert = jest.fn().mockResolvedValue({ error: upsertError });

  const from = jest.fn((table: string) => {
    if (table === "projects") {
      return { select: () => ({ or: projectsOr }) };
    }
    if (table === "feedback") {
      return { select: () => ({ in: feedbackIn }) };
    }
    if (table === "feedback_read_status") {
      return { upsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from,
  });

  return { projectsOr, feedbackIn, upsert };
}

function postMarkAll() {
  return POST(
    new Request("https://mentormates.ai/api/feedback/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }),
  );
}

describe("POST /api/feedback/mark-read with markAll", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("persists a read row for all feedback on the user's projects", async () => {
    const { projectsOr, feedbackIn, upsert } = mockSupabase();

    const response = await postMarkAll();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(projectsOr).toHaveBeenCalledWith(
      'lead_email.eq.lead@example.com,teammates.cs.{"lead@example.com"}',
    );
    expect(feedbackIn).toHaveBeenCalledWith("project_id", [
      "project-1",
      "project-2",
    ]);
    expect(upsert).toHaveBeenCalledWith(
      [
        { feedback_id: "feedback-1", user_id: USER.id },
        { feedback_id: "feedback-2", user_id: USER.id },
      ],
      { onConflict: "feedback_id,user_id", ignoreDuplicates: true },
    );
  });

  it("returns 500 and writes nothing when the projects query fails", async () => {
    const { upsert } = mockSupabase({
      projects: { data: null, error: { code: "57014" } },
    });

    const response = await postMarkAll();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to mark all as read",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 500 and writes nothing when the feedback query fails", async () => {
    const { upsert } = mockSupabase({
      feedback: { data: null, error: { code: "57014" } },
    });

    const response = await postMarkAll();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to mark all as read",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 500 when the read rows cannot be written", async () => {
    mockSupabase({ upsertError: { code: "42501" } });

    const response = await postMarkAll();

    expect(response.status).toBe(500);
  });

  it("succeeds without a write when the user has no projects", async () => {
    const { feedbackIn, upsert } = mockSupabase({
      projects: { data: [], error: null },
    });

    const response = await postMarkAll();

    expect(response.status).toBe(200);
    expect(feedbackIn).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("succeeds without a write when the projects have no feedback", async () => {
    const { upsert } = mockSupabase({ feedback: { data: [], error: null } });

    const response = await postMarkAll();

    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not query projects for a user without an email", async () => {
    const { projectsOr, upsert } = mockSupabase({ user: { id: USER.id } });

    const response = await postMarkAll();

    expect(response.status).toBe(200);
    expect(projectsOr).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabase({ user: null });

    const response = await postMarkAll();

    expect(response.status).toBe(401);
  });
});
