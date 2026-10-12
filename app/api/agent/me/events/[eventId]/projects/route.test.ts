/** @jest-environment jsdom */

import { POST, GET } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";
import { listParticipantProjectsByEvent } from "@/lib/projects/participant-projects";
import { NextResponse } from "next/server";

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
  resolveAgentPathEvent: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/projects/submission-service", () => ({
  normalizeProjectWriteInput: jest.fn(),
  saveProjectSubmission: jest.fn(),
}));

jest.mock("@/lib/projects/participant-projects", () => ({
  listParticipantProjectsByEvent: jest.fn(),
}));

const mockAuth = {
  userId: "user-1",
  eventId: "",
  scopes: ["participant-projects:write", "participant-projects:read"],
  keyId: "key-1",
};

const resolvedAuth = { ...mockAuth, eventId: "event-1" };

function mockProfileQuery(
  profile: { email: string; display_name: string } | null = {
    email: "user@example.com",
    display_name: "Test User",
  }
) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: profile, error: null }),
  };
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue(q),
  });
  return q;
}

function makeRequest(body: unknown | "malformed" | "empty", eventRef = "event-1") {
  const url = new URL(
    `https://mentormates.ai/api/agent/me/events/${eventRef}/projects`
  );
  return {
    json: async () => {
      if (body === "malformed") {
        throw new SyntaxError("Unexpected token in JSON at position 0");
      }
      if (body === "empty") {
        throw new SyntaxError("Unexpected end of JSON input");
      }
      return body;
    },
    nextUrl: url,
  };
}

function makeContext(eventId = "event-1") {
  return { params: Promise.resolve({ eventId }) };
}

describe("POST /api/agent/me/events/[eventId]/projects", () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    (requireScope as jest.Mock).mockReturnValue(null);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(mockAuth);
    (resolveAgentPathEvent as jest.Mock).mockResolvedValue(resolvedAuth);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(resolvedAuth);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ---------- Malformed JSON handling (the core bug) ----------

  it("returns 400 (not 500) when body is malformed JSON", async () => {
    mockProfileQuery();
    const res = await POST(makeRequest("malformed") as never, makeContext());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/json|body/i);
  });

  it("returns 400 (not 500) when body is empty", async () => {
    mockProfileQuery();
    const res = await POST(makeRequest("empty") as never, makeContext());
    expect(res.status).toBe(400);
  });

  it("logs malformed JSON with request context", async () => {
    mockProfileQuery();
    await POST(makeRequest("malformed", "arancornell") as never, makeContext());

    // Find the structured log line (JSON-parseable)
    const logged = errorSpy.mock.calls
      .map((args) => args[0])
      .filter((v): v is string => typeof v === "string")
      .map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      })
      .filter((v): v is Record<string, unknown> => v !== null);

    const submitEvent = logged.find(
      (p) => typeof p.event === "string" && p.event.includes("submit")
    );
    expect(submitEvent).toBeDefined();
    expect(submitEvent).toMatchObject({
      eventId: "event-1",
      userId: "user-1",
      keyId: "key-1",
    });
  });

  // ---------- Auth + scope propagation ----------

  it("propagates 401 from authenticateAgentRequest", async () => {
    const authErr = NextResponse.json({ error: "unauth" }, { status: 401 });
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authErr);
    const res = await POST(makeRequest({}) as never, makeContext());
    expect(res).toBe(authErr);
  });

  it("propagates 403 from requireScope", async () => {
    const scopeErr = NextResponse.json({ error: "scope" }, { status: 403 });
    (requireScope as jest.Mock).mockReturnValue(scopeErr);
    const res = await POST(makeRequest({}) as never, makeContext());
    expect(res).toBe(scopeErr);
  });

  it("propagates 404 from resolveAgentPathEvent (event slug not found)", async () => {
    const notFound = NextResponse.json({ error: "Event not found" }, { status: 404 });
    (resolveAgentPathEvent as jest.Mock).mockResolvedValue(notFound);
    const res = await POST(makeRequest({}) as never, makeContext("ghost-slug"));
    expect(res).toBe(notFound);
  });

  it("propagates 403 from authorizeAgentEventAccess (not a participant)", async () => {
    const forbidden = NextResponse.json({ error: "forbidden" }, { status: 403 });
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(forbidden);
    const res = await POST(makeRequest({}) as never, makeContext());
    expect(res).toBe(forbidden);
  });

  // ---------- Profile + validation ----------

  it("returns 400 when user_profiles row missing email", async () => {
    mockProfileQuery({ email: "", display_name: "" });
    const res = await POST(makeRequest({}) as never, makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when normalizeProjectWriteInput fails", async () => {
    mockProfileQuery();
    (normalizeProjectWriteInput as jest.Mock).mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { project_name: ["required"] } }) },
    });
    const res = await POST(
      makeRequest({ project_description: "no name" }) as never,
      makeContext()
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Invalid request");
    expect(body.details).toBeDefined();
  });

  it("rejects payload containing projectId (use PATCH instead)", async () => {
    mockProfileQuery();
    (normalizeProjectWriteInput as jest.Mock).mockReturnValue({
      success: true,
      data: { projectId: "existing-id", project_name: "X" },
    });
    const res = await POST(makeRequest({ projectId: "existing-id" }) as never, makeContext());
    expect(res.status).toBe(400);
  });

  // ---------- saveProjectSubmission error propagation ----------

  it("propagates structured error from saveProjectSubmission", async () => {
    mockProfileQuery();
    (normalizeProjectWriteInput as jest.Mock).mockReturnValue({
      success: true,
      data: { project_name: "Test Project" },
    });
    (saveProjectSubmission as jest.Mock).mockResolvedValue({
      status: 409,
      error: "Event submission window closed",
      event_name: "Ara x Cornell",
    });
    const res = await POST(
      makeRequest({ project_name: "Test" }) as never,
      makeContext()
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; event_name: string };
    expect(body.error).toBe("Event submission window closed");
    expect(body.event_name).toBe("Ara x Cornell");
    // `status` should not leak into the body — only header
    expect(body).not.toHaveProperty("status");
  });

  it("returns success envelope on happy path", async () => {
    mockProfileQuery();
    (normalizeProjectWriteInput as jest.Mock).mockReturnValue({
      success: true,
      data: { project_name: "Test Project" },
    });
    (saveProjectSubmission as jest.Mock).mockResolvedValue({
      status: 200,
      project: { id: "project-1", project_name: "Test Project" },
    });

    const res = await POST(
      makeRequest({ project_name: "Test Project" }) as never,
      makeContext()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      project: { id: string; project_name: string };
    };
    expect(body.success).toBe(true);
    expect(body.project.id).toBe("project-1");
  });

  // ---------- Uncaught exception → structured 500 ----------

  it("returns structured 500 JSON when a downstream throws unexpectedly", async () => {
    mockProfileQuery();
    (normalizeProjectWriteInput as jest.Mock).mockImplementation(() => {
      throw new Error("unexpected blowup");
    });
    const res = await POST(
      makeRequest({ project_name: "X" }) as never,
      makeContext()
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal server error");

    // Log line should capture the error with context
    const logged = errorSpy.mock.calls
      .map((args) => args[0])
      .filter((v): v is string => typeof v === "string")
      .map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      })
      .filter((v): v is Record<string, unknown> => v !== null);
    const crashLog = logged.find((p) => p.error_message === "unexpected blowup");
    expect(crashLog).toBeDefined();
    expect(crashLog).toMatchObject({ userId: "user-1", eventId: "event-1" });
  });
});

describe("GET /api/agent/me/events/[eventId]/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    (requireScope as jest.Mock).mockReturnValue(null);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(mockAuth);
    (resolveAgentPathEvent as jest.Mock).mockResolvedValue(resolvedAuth);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(resolvedAuth);
  });

  it("lists participant projects for the event", async () => {
    mockProfileQuery();
    (listParticipantProjectsByEvent as jest.Mock).mockResolvedValue([
      { id: "p-1", project_name: "A" },
    ]);
    const res = await GET(makeRequest(undefined) as never, makeContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: Array<{ id: string }> };
    expect(body.projects).toHaveLength(1);
  });

  it("propagates slug-not-found 404 from resolveAgentPathEvent", async () => {
    const notFound = NextResponse.json({ error: "Event not found" }, { status: 404 });
    (resolveAgentPathEvent as jest.Mock).mockResolvedValue(notFound);
    const res = await GET(makeRequest(undefined) as never, makeContext("ghost"));
    expect(res).toBe(notFound);
  });
});
