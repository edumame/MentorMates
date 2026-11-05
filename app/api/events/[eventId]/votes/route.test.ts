/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

function makeRequest() {
  return {
    json: jest.fn().mockResolvedValue({ projectId: "project-1" }),
  } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

type DbError = { code: string; message: string } | null;

function mockSupabase({
  project = { id: "project-1", event_id: "event-1", submitted: true },
  voteCount = 0,
  insertResults = [null],
}: {
  project?: { id: string; event_id: string; submitted: boolean | null };
  voteCount?: number;
  insertResults?: DbError[];
} = {}) {
  const roleBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: { role: "participant" }, error: null }),
  };
  const projectBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: project, error: null }),
  };

  const countBuilder = {
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) =>
      resolve({ count: voteCount, error: null }),
  };
  const insert = jest.fn();
  for (const error of insertResults) {
    insert.mockResolvedValueOnce({ error });
  }
  const votesBuilder = {
    select: jest.fn().mockReturnValue(countBuilder),
    insert,
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "user_event_roles") return roleBuilder;
      if (table === "projects") return projectBuilder;
      if (table === "project_votes") return votesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });

  return { insert };
}

describe("POST /api/events/[eventId]/votes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("casts a vote for a submitted project in the event", async () => {
    const { insert } = mockSupabase({ voteCount: 2 });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, remainingVotes: 0 });
    expect(insert).toHaveBeenCalledWith({
      project_id: "project-1",
      user_id: "user-1",
      event_id: "event-1",
    });
  });

  it.each([false, null])(
    "rejects a project whose submitted flag is %s",
    async (submitted) => {
      const { insert } = mockSupabase({
        project: { id: "project-1", event_id: "event-1", submitted },
      });

      const response = await POST(makeRequest(), makeContext());

      expect(response.status).toBe(400);
      expect(insert).not.toHaveBeenCalled();
    }
  );

  it("lets only one of two concurrent votes through when the database cap trips", async () => {
    const capError = {
      code: "VT003",
      message: "You can only vote for 3 projects per event",
    };
    mockSupabase({ voteCount: 2, insertResults: [null, capError] });

    const responses = await Promise.all([
      POST(makeRequest(), makeContext()),
      POST(makeRequest(), makeContext()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    const rejected = responses.find((response) => response.status === 400);
    expect(await rejected?.json()).toEqual({ error: capError.message });
  });

  it.each([
    ["VT001", 403, "Only event members who are not judges can vote"],
    ["VT002", 400, "Only submitted projects in this event can receive votes"],
    ["VT003", 400, "You can only vote for 3 projects per event"],
  ])("maps database rule %s to HTTP %i", async (code, status, message) => {
    mockSupabase({ insertResults: [{ code, message }] });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it("still reports an unknown insert failure as a server error", async () => {
    mockSupabase({ insertResults: [{ code: "XX000", message: "boom" }] });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to cast vote" });
  });

  it("keeps the duplicate vote message", async () => {
    mockSupabase({
      insertResults: [{ code: "23505", message: "duplicate key value" }],
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "You have already voted for this project",
    });
  });
});
