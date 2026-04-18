/** @jest-environment jsdom */

import { GET, PATCH } from "./route";
import { authenticateAgentRequest, authorizeAgentEventAccess, requireScope } from "@/lib/agent/auth";
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
});
