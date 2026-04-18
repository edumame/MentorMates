/** @jest-environment jsdom */

import { GET, PATCH } from "./route";
import { authenticateAgentRequest, authorizeAgentEventAccess, requireScope } from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("GET /api/agent/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireScope as jest.Mock).mockReturnValue(null);
  });

  it("returns a paginated list of editable events when a reusable key omits event_id", async () => {
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      eventId: "",
      scopes: ["event:read"],
      keyId: "key-1",
    });

    const ownerEventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "11111111-1111-4111-8111-111111111111",
            event_name: "Founder Demo Day",
          },
        ],
        error: null,
      }),
    };
    const organizerRolesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    organizerRolesQuery.eq = jest
      .fn()
      .mockReturnValueOnce(organizerRolesQuery)
      .mockResolvedValue({
        data: [{ event_id: "22222222-2222-4222-8222-222222222222" }],
        error: null,
      });
    const organizerEventsQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            event_id: "22222222-2222-4222-8222-222222222222",
            event_name: "Student Hackathon",
          },
        ],
        error: null,
      }),
    };
    let eventsFromCalls = 0;

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
      from: jest.fn((table: string) => {
        if (table === "events") {
          eventsFromCalls += 1;
          return eventsFromCalls === 1 ? ownerEventsQuery : organizerEventsQuery;
        }
        if (table === "user_event_roles") {
          return organizerRolesQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await GET({
      nextUrl: new URL("https://mentormates.ai/api/agent/events?limit=1&offset=1"),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "event_id or event_slug query parameter is required for reusable keys",
      requires_event_id: true,
      events: [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
          event_name: "Student Hackathon",
        },
      ],
      total: 2,
      limit: 1,
      offset: 1,
    });
    expect(authorizeAgentEventAccess).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/agent/events (expanded field set)", () => {
  const mockAuth = {
    userId: "user-1",
    eventId: "event-1",
    scopes: ["event:write"],
    keyId: "key-1",
  };

  function mockUpdateChain(returnEvent = { event_id: "event-1", event_name: "Updated" }) {
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: returnEvent, error: null }),
    };
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(updateQuery),
    });
    return updateQuery;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(mockAuth);
    (requireScope as jest.Mock).mockReturnValue(null);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({ eventId: "event-1" });
  });

  async function patchWith(body: Record<string, unknown>) {
    const req = {
      json: async () => body,
      nextUrl: new URL("https://mentormates.ai/api/agent/events?event_id=event-1"),
    };
    return PATCH(req as never);
  }

  it("accepts event_prizes array", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      event_prizes: [
        { track: "Overall Winner", prize: "Scooter", description: "judges" },
      ],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_prizes: [
          { track: "Overall Winner", prize: "Scooter", description: "judges" },
        ],
      })
    );
  });

  it("accepts event_schedule array of blocks", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      event_schedule: [{ time: "Day 1", events: [{ name: "Kickoff", time: "1 PM" }] }],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ event_schedule: expect.any(Array) })
    );
  });

  it("accepts event_resources array", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      event_resources: [{ name: "Docs", link: "https://example.com/docs" }],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_resources: [{ name: "Docs", link: "https://example.com/docs" }],
      })
    );
  });

  it("accepts scoring_config object", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      scoring_config: { tracks: { overall: { name: "Overall", criteria: [] } } },
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ scoring_config: expect.any(Object) })
    );
  });

  it("accepts rules array", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      rules: [{ title: "Code of Conduct", items: ["Be kind"] }],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ rules: expect.any(Array) })
    );
  });

  it("accepts faq array", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      faq: [{ question: "When?", answer: "Tomorrow" }],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ faq: expect.any(Array) })
    );
  });

  it("accepts cover_image_url", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ cover_image_url: "https://example.com/cover.png" });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ cover_image_url: "https://example.com/cover.png" })
    );
  });

  it("accepts slug", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ slug: "new-slug" });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ slug: "new-slug" }));
  });

  it("accepts visibility enum", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ visibility: "public" });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ visibility: "public" }));
  });

  it("rejects invalid visibility enum", async () => {
    mockUpdateChain();
    const res = await patchWith({ visibility: "not-a-real-value" });
    expect(res.status).toBe(400);
  });

  it("accepts paid boolean", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ paid: true });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ paid: true }));
  });

  it("accepts role_labels", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      role_labels: { participant: "Hacker", judge: "Reviewer" },
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ role_labels: expect.any(Object) })
    );
  });

  it("accepts finalist_recommendation_enabled", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ finalist_recommendation_enabled: true });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ finalist_recommendation_enabled: true })
    );
  });

  it("rejects admin-only fields (featured, approval_status, rejection_reason)", async () => {
    mockUpdateChain();
    const res = await patchWith({ featured: true });
    expect(res.status).toBe(400);

    const res2 = await patchWith({ approval_status: "approved" });
    expect(res2.status).toBe(400);

    const res3 = await patchWith({ rejection_reason: "because" });
    expect(res3.status).toBe(400);
  });

  it("rejects immutable fields (event_id, owner_id, created_at)", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_id: "malicious" });
    expect(res.status).toBe(400);

    const res2 = await patchWith({ owner_id: "someone-else" });
    expect(res2.status).toBe(400);
  });

  it("still accepts the existing supported fields", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({
      event_name: "New Name",
      event_description: "desc",
      event_blurb: "blurb",
      event_date: "2026-05-01",
      location: "Brooklyn",
      submission_time_start: "2026-05-01T12:00:00Z",
      submission_time_cutoff: "2026-05-01T18:00:00Z",
      participant_capacity: 50,
      require_participant_approval: true,
      event_type: ["hackathon"],
    });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "New Name",
        participant_capacity: 50,
        event_type: ["hackathon"],
      })
    );
  });

  // ---------- Boundary / validation tests ----------

  it("rejects event_name longer than 200 chars", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_name: "a".repeat(201) });
    expect(res.status).toBe(400);
  });

  it("accepts event_name at exactly 200 chars", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_name: "a".repeat(200) });
    expect(res.status).toBe(200);
  });

  it("rejects empty event_name", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_name: "" });
    expect(res.status).toBe(400);
  });

  it("rejects event_description longer than 5000 chars", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_description: "a".repeat(5001) });
    expect(res.status).toBe(400);
  });

  it("rejects location longer than 500 chars", async () => {
    mockUpdateChain();
    const res = await patchWith({ location: "a".repeat(501) });
    expect(res.status).toBe(400);
  });

  it("rejects slug longer than 100 chars", async () => {
    mockUpdateChain();
    const res = await patchWith({ slug: "a".repeat(101) });
    expect(res.status).toBe(400);
  });

  // ---------- Slug pattern (security) ----------

  it("rejects slug with path traversal characters", async () => {
    mockUpdateChain();
    const res = await patchWith({ slug: "../../../admin" });
    expect(res.status).toBe(400);
  });

  it("rejects slug with spaces", async () => {
    mockUpdateChain();
    const res = await patchWith({ slug: "hello world" });
    expect(res.status).toBe(400);
  });

  it("accepts valid kebab-case slug", async () => {
    mockUpdateChain();
    const res = await patchWith({ slug: "ara-x-cornell-2026" });
    expect(res.status).toBe(200);
  });

  // ---------- Nested shape .strict() ----------

  it("rejects event_prizes with extra keys on prize objects", async () => {
    mockUpdateChain();
    const res = await patchWith({
      event_prizes: [{ track: "t", prize: "p", evil_field: "injected" }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects event_prizes missing required track", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_prizes: [{ prize: "p" }] });
    expect(res.status).toBe(400);
  });

  it("rejects rules with extra keys", async () => {
    mockUpdateChain();
    const res = await patchWith({
      rules: [{ title: "t", items: ["i"], hidden: "x" }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects faq missing answer", async () => {
    mockUpdateChain();
    const res = await patchWith({ faq: [{ question: "q" }] });
    expect(res.status).toBe(400);
  });

  it("rejects event_resources missing link", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_resources: [{ name: "Docs" }] });
    expect(res.status).toBe(400);
  });

  it("rejects event_resources with invalid url", async () => {
    mockUpdateChain();
    const res = await patchWith({
      event_resources: [{ name: "Docs", link: "not-a-url" }],
    });
    expect(res.status).toBe(400);
  });

  // ---------- Wrong types ----------

  it("rejects event_prizes as a string", async () => {
    mockUpdateChain();
    const res = await patchWith({ event_prizes: "not an array" });
    expect(res.status).toBe(400);
  });

  it("rejects participant_capacity as a string", async () => {
    mockUpdateChain();
    const res = await patchWith({ participant_capacity: "fifty" });
    expect(res.status).toBe(400);
  });

  it("rejects paid as a string", async () => {
    mockUpdateChain();
    const res = await patchWith({ paid: "true" });
    expect(res.status).toBe(400);
  });

  // ---------- Visibility: archived flows through separate archive route ----------

  it("rejects visibility='archived' (use archive route instead)", async () => {
    mockUpdateChain();
    const res = await patchWith({ visibility: "archived" });
    expect(res.status).toBe(400);
  });

  // ---------- Null semantics ----------

  it("accepts cover_image_url: null (clears the field)", async () => {
    const q = mockUpdateChain();
    const res = await patchWith({ cover_image_url: null });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({ cover_image_url: null })
    );
  });

  it("rejects cover_image_url with invalid url", async () => {
    mockUpdateChain();
    const res = await patchWith({ cover_image_url: "not a url" });
    expect(res.status).toBe(400);
  });

  // ---------- Empty body ----------

  it("rejects empty PATCH body (nothing to update)", async () => {
    mockUpdateChain();
    const res = await patchWith({});
    expect(res.status).toBe(400);
  });

  // ---------- Auth propagation ----------

  it("propagates 403 when requireScope denies", async () => {
    const scopeErrorResp = { status: 403 };
    (requireScope as jest.Mock).mockReturnValue(scopeErrorResp);
    const res = await patchWith({ event_name: "New Name" });
    expect(res).toBe(scopeErrorResp);
  });

  it("propagates 403 when authorizeAgentEventAccess denies", async () => {
    // authorizeAgentEventAccess returns a NextResponse on failure. Must be
    // a real (mocked) NextResponse instance so the `instanceof` check hits.
    const accessErrorResp = NextResponse.json({ error: "forbidden" }, { status: 403 });
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(accessErrorResp);
    const res = await patchWith({ event_name: "New Name" });
    expect(res).toBe(accessErrorResp);
  });

  // ---------- DB error paths ----------

  it("returns 500 when Supabase update returns an error", async () => {
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "boom" },
      }),
    };
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(updateQuery),
    });
    const res = await patchWith({ event_name: "New Name" });
    expect(res.status).toBe(500);
  });
});
