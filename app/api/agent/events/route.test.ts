/** @jest-environment jsdom */

import { GET, PATCH, POST } from "./route";
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

  describe("with a bound event", () => {
    function mockEventOverview(
      roleResult: (role: string | undefined) => {
        count: number | null;
        error: { message: string } | null;
      },
    ) {
      const eventQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { event_id: "event-1", event_name: "Big Event" },
          error: null,
        }),
      };
      const countQuery = (result: { count: number; error: null }) => {
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: (resolve: (value: typeof result) => unknown) =>
            Promise.resolve(result).then(resolve),
        };
        return query;
      };
      // Mirrors PostgREST: a row request is capped at 1000, a head count is not.
      const rolesQuery = () => {
        let role: string | undefined;
        let head = false;
        const query = {
          select(_columns: string, options?: { head?: boolean }) {
            head = options?.head === true;
            return this;
          },
          eq(column: string, value: string) {
            if (column === "role") role = value;
            return this;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(
              head
                ? { ...roleResult(role), data: null }
                : {
                    data: Array.from({ length: 1000 }, () => ({
                      role: "participant",
                    })),
                    error: null,
                  },
            ).then(resolve),
        };
        return query;
      };

      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === "events") return eventQuery;
          if (table === "user_event_roles") return rolesQuery();
          if (table === "projects") {
            return countQuery({ count: 7, error: null });
          }
          if (table === "participant_approval_requests") {
            return countQuery({ count: 2, error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      });
    }

    const request = {
      nextUrl: new URL(
        "https://mentormates.ai/api/agent/events?event_id=event-1",
      ),
    } as never;

    beforeEach(() => {
      (authenticateAgentRequest as jest.Mock).mockResolvedValue({
        userId: "user-1",
        eventId: "event-1",
        scopes: ["event:read"],
        keyId: "key-1",
      });
      (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({});
    });

    it("reports exact role counts above the row cap", async () => {
      const exactCounts: Record<string, number> = {
        participant: 1500,
        mentor: 40,
        judge: 25,
        organizer: 5,
      };
      mockEventOverview((role) => ({
        // No role filter is the total, which also includes admins.
        count: role ? exactCounts[role] : 1573,
        error: null,
      }));

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.counts).toEqual({
        participants: 1500,
        mentors: 40,
        judges: 25,
        organizers: 5,
        total: 1573,
      });
      expect(body.projects_count).toBe(7);
      expect(body.pending_approvals).toBe(2);
    });

    it("returns an error instead of partial counts when a role count fails", async () => {
      mockEventOverview((role) =>
        role === "judge"
          ? { count: null, error: { message: "boom" } }
          : { count: 1, error: null },
      );
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await GET(request);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Failed to fetch role counts",
      });
      consoleError.mockRestore();
    });
  });
});

const approvedAccess = {
  eventId: "event-1",
  isAdmin: false,
  isOwner: true,
  userRole: "organizer",
  visibility: "private",
  approvalStatus: "approved",
  featured: false,
};

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
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(approvedAccess);
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
  // ---------- XL-001: same publish-approval / archived rules as the triggers ----------

  it("refuses visibility=public for an unapproved event (403) and does not write", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      visibility: "draft",
      approvalStatus: "not_submitted",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ visibility: "public" });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Events can only be made public after they are approved",
    });
    expect(q.update).not.toHaveBeenCalled();
  });

  it.each(["submitted", "rejected", null])(
    "refuses visibility=public when approval_status is %p",
    async (approvalStatus) => {
      (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
        ...approvedAccess,
        approvalStatus,
      });
      const q = mockUpdateChain();
      const res = await patchWith({ visibility: "public" });
      expect(res.status).toBe(403);
      expect(q.update).not.toHaveBeenCalled();
    }
  );

  it.each(["demo", "test"])("refuses visibility=%s for a non-admin key owner", async (visibility) => {
    const q = mockUpdateChain();
    const res = await patchWith({ visibility });
    expect(res.status).toBe(403);
    expect(q.update).not.toHaveBeenCalled();
  });

  it("lets an admin key owner publish an unapproved event", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      isAdmin: true,
      approvalStatus: "not_submitted",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ visibility: "public" });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalled();
  });

  it("refuses edits to an archived event with 409 (rename + republish)", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      visibility: "archived",
      approvalStatus: "not_submitted",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ event_name: "Renamed", visibility: "public" });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "archived events are read-only; unarchive first",
    });
    expect(q.update).not.toHaveBeenCalled();
  });

  it("refuses a field edit on an archived event even without a visibility change", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      visibility: "archived",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ event_name: "Renamed" });
    expect(res.status).toBe(409);
    expect(q.update).not.toHaveBeenCalled();
  });

  it("lets a manager unarchive to private (visibility-only change)", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      visibility: "archived",
      approvalStatus: "not_submitted",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ visibility: "private" });
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith({ visibility: "private" });
  });

  it("refuses unarchiving straight to public when not approved", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      ...approvedAccess,
      visibility: "archived",
      approvalStatus: "not_submitted",
    });
    const q = mockUpdateChain();
    const res = await patchWith({ visibility: "public" });
    expect(res.status).toBe(403);
    expect(q.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/events (create moderation, XL-001)", () => {
  const mockAuth = {
    userId: "user-1",
    eventId: "",
    scopes: ["event:write"],
    keyId: "key-1",
  };

  function mockCreate({ isAdmin = false }: { isAdmin?: boolean } = {}) {
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { event_id: "new-1", event_name: "QA Created", visibility: "draft" },
        error: null,
      }),
    };
    const roleQuery = { upsert: jest.fn().mockResolvedValue({ error: null }) };
    const rpc = jest.fn().mockResolvedValue({ data: isAdmin, error: null });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      rpc,
      from: jest.fn((table: string) =>
        table === "events" ? insertQuery : roleQuery
      ),
    });
    return { insertQuery, rpc };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(mockAuth);
    (requireScope as jest.Mock).mockReturnValue(null);
  });

  async function postWith(body: Record<string, unknown>) {
    const req = {
      json: async () => body,
      nextUrl: new URL("https://mentormates.ai/api/agent/events"),
    };
    return POST(req as never);
  }

  const base = { event_name: "QA Created", event_date: "2027-01-20", location: "QA" };

  it.each(["public", "demo", "test"])(
    "refuses visibility=%s for a non-admin and inserts nothing",
    async (visibility) => {
      const { insertQuery, rpc } = mockCreate();
      const res = await postWith({ ...base, visibility });
      expect(res.status).toBe(403);
      expect(rpc).toHaveBeenCalledWith("is_admin_user", { user_id: "user-1" });
      expect(insertQuery.insert).not.toHaveBeenCalled();
    }
  );

  it.each(["draft", "private"])("creates a %s event unapproved and unfeatured", async (visibility) => {
    const { insertQuery } = mockCreate();
    const res = await postWith({ ...base, visibility });
    expect(res.status).toBe(201);
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ visibility, approval_status: "not_submitted", featured: false })
    );
  });

  it("defaults to draft when visibility is omitted", async () => {
    const { insertQuery } = mockCreate();
    const res = await postWith(base);
    expect(res.status).toBe(201);
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "draft" })
    );
  });

  it("lets an admin create a public event", async () => {
    const { insertQuery } = mockCreate({ isAdmin: true });
    const res = await postWith({ ...base, visibility: "public" });
    expect(res.status).toBe(201);
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "public" })
    );
  });

  it("returns 500 when the admin check fails", async () => {
    const { insertQuery, rpc } = mockCreate();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await postWith({ ...base, visibility: "draft" });
    expect(res.status).toBe(500);
    expect(insertQuery.insert).not.toHaveBeenCalled();
  });
});

describe("agent event_prizes reach the prizes table", () => {
  const AI_TRACK = { track_id: "track-ai", name: "AI" };
  const WEB_TRACK = { track_id: "track-web", name: "Web" };

  type DbError = { message: string } | null;

  // Fake client backing only what these handlers touch. Tracks written through
  // insert() are readable afterwards, as they are in the real database.
  function mockDb({
    tracks = [] as { track_id: string; name: string }[],
    existingPrizes = [] as {
      track_id: string;
      prize_amount: string;
      prize_description: string;
    }[],
    trackReadError = null as DbError,
    prizeReadError = null as DbError,
    prizeInsertError = null as DbError,
  } = {}) {
    const storedTracks = [...tracks];
    const prizeInsert = jest.fn().mockResolvedValue({ error: prizeInsertError });
    const prizeReadIn = jest
      .fn()
      .mockResolvedValue({ data: existingPrizes, error: prizeReadError });
    const eventRow = {
      event_id: "event-1",
      event_name: "Hack Day",
      event_date: "2026-05-01",
      visibility: "draft",
      slug: null,
    };
    const eventsQuery = {
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: eventRow, error: null }),
    };

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      // POST checks is_admin_user for create moderation (XL-001); the event
      // here is a draft, so a non-admin is fine.
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
      from: jest.fn((table: string) => {
        if (table === "events") return eventsQuery;
        if (table === "user_event_roles") {
          return { upsert: jest.fn().mockResolvedValue({ error: null }) };
        }
        if (table === "event_tracks") {
          return {
            insert: jest.fn(async (rows: typeof storedTracks) => {
              storedTracks.push(...rows);
              return { error: null };
            }),
            select: () => ({
              eq: async () => ({
                data: trackReadError ? null : storedTracks,
                error: trackReadError,
              }),
            }),
          };
        }
        if (table === "prizes") {
          return {
            select: () => ({ in: prizeReadIn }),
            insert: prizeInsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    return { eventsQuery, prizeInsert, prizeReadIn };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (requireScope as jest.Mock).mockReturnValue(null);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({ eventId: "event-1" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST", () => {
    beforeEach(() => {
      (authenticateAgentRequest as jest.Mock).mockResolvedValue({
        userId: "user-1",
        eventId: "",
        scopes: ["event:write"],
        keyId: "key-1",
      });
    });

    async function postWith(body: Record<string, unknown>) {
      return POST({
        json: async () => ({
          event_name: "Hack Day",
          event_date: "2026-05-01",
          location: "Brooklyn",
          ...body,
        }),
      } as never);
    }

    it("creates a prize row on the track named by each prize", async () => {
      const { eventsQuery, prizeInsert } = mockDb();

      const res = await postWith({
        tracks: [{ name: "AI" }, { name: "Web" }],
        event_prizes: [
          { track: "Web", prize: "$500", description: "Best site" },
          { track: "AI", prize: "$1000" },
        ],
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(prizeInsert).toHaveBeenCalledTimes(1);
      const rows = prizeInsert.mock.calls[0][0];
      expect(rows).toEqual([
        expect.objectContaining({
          track_id: expect.any(String),
          prize_amount: "$500",
          prize_description: "Best site",
        }),
        expect.objectContaining({
          track_id: expect.any(String),
          prize_amount: "$1000",
          prize_description: "",
        }),
      ]);
      expect(rows[0].track_id).not.toBe(rows[1].track_id);
      expect(body).toMatchObject({
        prizes_created: [
          { track: "Web", prize: "$500" },
          { track: "AI", prize: "$1000" },
        ],
        skipped_prizes: [],
      });
      // The legacy column is still returned by agent GET and copied on duplicate.
      expect(eventsQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_prizes: expect.arrayContaining([
            expect.objectContaining({ prize: "$1000" }),
          ]),
        })
      );
    });

    it("matches track names ignoring case and surrounding whitespace", async () => {
      const { prizeInsert } = mockDb();

      const res = await postWith({
        tracks: [{ name: "AI" }],
        event_prizes: [{ track: " ai ", prize: "$1000" }],
      });

      expect(prizeInsert).toHaveBeenCalledTimes(1);
      await expect(res.json()).resolves.toMatchObject({ skipped_prizes: [] });
    });

    it("reports a prize whose track does not exist and still saves the rest", async () => {
      const { prizeInsert } = mockDb();

      const res = await postWith({
        tracks: [{ name: "AI" }],
        event_prizes: [
          { track: "AI", prize: "$1000" },
          { track: "Hardware", prize: "$200" },
        ],
      });

      expect(res.status).toBe(201);
      expect(prizeInsert.mock.calls[0][0]).toHaveLength(1);
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [{ track: "AI", prize: "$1000" }],
        skipped_prizes: [
          { track: "Hardware", prize: "$200", reason: "no_matching_track" },
        ],
      });
    });

    it("reports every prize when the event has no tracks", async () => {
      const { prizeInsert } = mockDb();

      const res = await postWith({
        event_prizes: [{ track: "AI", prize: "$1000" }],
      });

      expect(res.status).toBe(201);
      expect(prizeInsert).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [
          { track: "AI", prize: "$1000", reason: "no_matching_track" },
        ],
      });
    });

    it("reports prizes as not saved when the insert fails", async () => {
      mockDb({ prizeInsertError: { message: "boom" } });

      const res = await postWith({
        tracks: [{ name: "AI" }],
        event_prizes: [{ track: "AI", prize: "$1000" }],
      });

      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [{ track: "AI", prize: "$1000", reason: "save_failed" }],
      });
    });

    it("touches no prizes when none are sent", async () => {
      const { prizeInsert, prizeReadIn } = mockDb();

      const res = await postWith({ tracks: [{ name: "AI" }] });

      expect(res.status).toBe(201);
      expect(prizeInsert).not.toHaveBeenCalled();
      expect(prizeReadIn).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [],
      });
    });
  });

  describe("PATCH", () => {
    beforeEach(() => {
      (authenticateAgentRequest as jest.Mock).mockResolvedValue({
        userId: "user-1",
        eventId: "event-1",
        scopes: ["event:write"],
        keyId: "key-1",
      });
    });

    async function patchWith(body: Record<string, unknown>) {
      return PATCH({
        json: async () => body,
        nextUrl: new URL("https://mentormates.ai/api/agent/events?event_id=event-1"),
      } as never);
    }

    it("creates prize rows on the event's existing tracks", async () => {
      const { eventsQuery, prizeInsert, prizeReadIn } = mockDb({
        tracks: [AI_TRACK, WEB_TRACK],
      });

      const res = await patchWith({
        event_prizes: [{ track: "ai", prize: "$1000", description: "Top" }],
      });

      expect(res.status).toBe(200);
      expect(eventsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ event_prizes: expect.any(Array) })
      );
      expect(prizeReadIn).toHaveBeenCalledWith("track_id", ["track-ai", "track-web"]);
      expect(prizeInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          track_id: "track-ai",
          prize_amount: "$1000",
          prize_description: "Top",
        }),
      ]);
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        prizes_created: [{ track: "ai", prize: "$1000" }],
        skipped_prizes: [],
      });
    });

    it("does not duplicate a prize the track already has, so retries are safe", async () => {
      const { prizeInsert } = mockDb({
        tracks: [AI_TRACK],
        existingPrizes: [
          { track_id: "track-ai", prize_amount: "$1000", prize_description: "" },
        ],
      });

      const res = await patchWith({
        event_prizes: [
          { track: "AI", prize: "$1000" },
          { track: "AI", prize: "$50" },
        ],
      });

      expect(res.status).toBe(200);
      expect(prizeInsert).toHaveBeenCalledWith([
        expect.objectContaining({ track_id: "track-ai", prize_amount: "$50" }),
      ]);
    });

    it("inserts nothing when an exact resend matches amount and description", async () => {
      const { prizeInsert } = mockDb({
        tracks: [AI_TRACK],
        existingPrizes: [
          { track_id: "track-ai", prize_amount: "$500", prize_description: "Best UX" },
        ],
      });

      const res = await patchWith({
        event_prizes: [{ track: "AI", prize: "$500", description: "Best UX" }],
      });

      expect(res.status).toBe(200);
      expect(prizeInsert).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [],
      });
    });

    it("saves a different prize that shares an amount with an existing one", async () => {
      const { prizeInsert } = mockDb({
        tracks: [AI_TRACK],
        existingPrizes: [
          { track_id: "track-ai", prize_amount: "$500", prize_description: "Best UX" },
        ],
      });

      const res = await patchWith({
        event_prizes: [{ track: "AI", prize: "$500", description: "Best backend" }],
      });

      expect(res.status).toBe(200);
      expect(prizeInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          track_id: "track-ai",
          prize_amount: "$500",
          prize_description: "Best backend",
        }),
      ]);
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [{ track: "AI", prize: "$500" }],
        skipped_prizes: [],
      });
    });

    it("treats a missing description as different from an existing description", async () => {
      const { prizeInsert } = mockDb({
        tracks: [AI_TRACK],
        existingPrizes: [
          { track_id: "track-ai", prize_amount: "$500", prize_description: "Best UX" },
        ],
      });

      await patchWith({ event_prizes: [{ track: "AI", prize: "$500" }] });

      expect(prizeInsert).toHaveBeenCalledWith([
        expect.objectContaining({ prize_amount: "$500", prize_description: "" }),
      ]);
    });

    it("does not confuse prizes whose amount and description split differently", async () => {
      const { prizeInsert } = mockDb({
        tracks: [AI_TRACK],
        existingPrizes: [
          { track_id: "track-ai", prize_amount: "$5:x", prize_description: "y" },
        ],
      });

      await patchWith({
        event_prizes: [{ track: "AI", prize: "$5", description: "x:y" }],
      });

      expect(prizeInsert).toHaveBeenCalledWith([
        expect.objectContaining({ prize_amount: "$5", prize_description: "x:y" }),
      ]);
    });

    it("reports a prize whose track does not exist", async () => {
      const { prizeInsert } = mockDb({ tracks: [AI_TRACK] });

      const res = await patchWith({
        event_prizes: [{ track: "Hardware", prize: "$200" }],
      });

      expect(res.status).toBe(200);
      expect(prizeInsert).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [
          { track: "Hardware", prize: "$200", reason: "no_matching_track" },
        ],
      });
    });

    it.each([
      ["tracks", { trackReadError: { message: "boom" } }],
      ["existing prizes", { prizeReadError: { message: "boom" } }],
    ])("saves nothing and reports it when reading %s fails", async (_, failure) => {
      const { prizeInsert } = mockDb({ tracks: [AI_TRACK], ...failure });

      const res = await patchWith({
        event_prizes: [{ track: "AI", prize: "$1000" }],
      });

      expect(res.status).toBe(200);
      expect(prizeInsert).not.toHaveBeenCalled();
      await expect(res.json()).resolves.toMatchObject({
        prizes_created: [],
        skipped_prizes: [{ track: "AI", prize: "$1000", reason: "save_failed" }],
      });
    });

    it("leaves the response and prizes alone when event_prizes is not sent", async () => {
      const { prizeInsert, prizeReadIn } = mockDb({ tracks: [AI_TRACK] });

      const res = await patchWith({ event_name: "Renamed" });

      expect(res.status).toBe(200);
      expect(prizeInsert).not.toHaveBeenCalled();
      expect(prizeReadIn).not.toHaveBeenCalled();
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("prizes_created");
      expect(body).not.toHaveProperty("skipped_prizes");
    });
  });
});
