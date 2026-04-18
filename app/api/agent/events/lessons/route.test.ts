/** @jest-environment jsdom */

import { GET, POST, PATCH, DELETE } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
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

const mockAuth = {
  userId: "user-1",
  eventId: "event-1",
  scopes: ["event:write"],
  keyId: "key-1",
};

function makeRequest(body: unknown, params: Record<string, string> = {}) {
  const url = new URL("https://mentormates.ai/api/agent/events/lessons?event_id=event-1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return {
    json: async () => body,
    nextUrl: url,
  };
}

describe("/api/agent/events/lessons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(mockAuth);
    (requireScope as jest.Mock).mockReturnValue(null);
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({ eventId: "event-1" });
  });

  describe("GET", () => {
    it("lists lessons for the event", async () => {
      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: "lesson-1",
              event_id: "event-1",
              title: "Intro",
              url: "https://vid.com/1",
              cover_image_url: "https://img.com/1",
              description: "An intro",
              duration_minutes: 10,
            },
          ],
          error: null,
        }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(selectQuery),
      });

      const res = await GET(makeRequest(undefined) as never);
      expect(res.status).toBe(200);
      const body = await res.json() as { lessons: unknown[] };
      expect(body.lessons).toHaveLength(1);
    });
  });

  describe("POST", () => {
    const validLesson = {
      title: "New Lesson",
      url: "https://vid.com/new",
      cover_image_url: "https://img.com/new",
      description: "A new lesson",
      duration_minutes: 30,
    };

    function mockInsertChain(data: unknown = { id: "lesson-new", ...validLesson, event_id: "event-1" }) {
      const q = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data, error: null }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });
      return q;
    }

    it("creates a lesson with valid payload", async () => {
      const q = mockInsertChain();
      const res = await POST(makeRequest(validLesson) as never);
      expect(res.status).toBe(201);
      expect(q.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Lesson",
          event_id: "event-1",
          duration_minutes: 30,
        })
      );
    });

    it("rejects missing required fields", async () => {
      mockInsertChain();
      const res = await POST(makeRequest({ title: "only title" }) as never);
      expect(res.status).toBe(400);
    });

    it("rejects non-positive duration_minutes", async () => {
      mockInsertChain();
      const res = await POST(makeRequest({ ...validLesson, duration_minutes: 0 }) as never);
      expect(res.status).toBe(400);
    });

    it("rejects invalid cover_image_url", async () => {
      mockInsertChain();
      const res = await POST(makeRequest({ ...validLesson, cover_image_url: "not-a-url" }) as never);
      expect(res.status).toBe(400);
    });

    it("enforces event:write scope", async () => {
      const scopeResponse = { status: 403 };
      (requireScope as jest.Mock).mockReturnValue(scopeResponse);
      const res = await POST(makeRequest(validLesson) as never);
      expect(res).toBe(scopeResponse);
    });
  });

  describe("PATCH", () => {
    const validLessonId = "11111111-2222-4333-8444-555555555555";

    function mockUpdateChain(data: unknown = { id: validLessonId, title: "Updated" }) {
      const q = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data, error: null }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });
      return q;
    }

    it("updates a lesson by lesson_id", async () => {
      const q = mockUpdateChain();
      const res = await PATCH(
        makeRequest({ lesson_id: validLessonId, title: "Updated" }) as never
      );
      expect(res.status).toBe(200);
      expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated" }));
    });

    it("rejects PATCH without lesson_id", async () => {
      mockUpdateChain();
      const res = await PATCH(makeRequest({ title: "whatever" }) as never);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("deletes a lesson by lesson_id query param", async () => {
      // The route now does a pre-existence SELECT (to surface 404 for
      // cross-event / missing lesson) before the DELETE. Mock both chains.
      const selectQuery: { select: jest.Mock; eq: jest.Mock } = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(),
      };
      selectQuery.eq
        .mockReturnValueOnce(selectQuery) // first .eq()
        .mockResolvedValueOnce({ data: [{ id: "lesson-1" }], error: null });

      const deleteQuery: { delete: jest.Mock; eq: jest.Mock } = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(),
      };
      deleteQuery.eq
        .mockReturnValueOnce(deleteQuery)
        .mockResolvedValueOnce({ error: null });

      let fromCalls = 0;
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => {
          fromCalls += 1;
          // first call = existence check (SELECT), second = DELETE
          return fromCalls === 1 ? selectQuery : deleteQuery;
        }),
      });

      const res = await DELETE(
        makeRequest(undefined, { lesson_id: "11111111-2222-4333-8444-555555555555" }) as never
      );
      expect(res.status).toBe(200);
      expect(deleteQuery.delete).toHaveBeenCalled();
    });

    it("rejects DELETE without lesson_id", async () => {
      const res = await DELETE(makeRequest(undefined) as never);
      expect(res.status).toBe(400);
    });
  });

  // ---------- POST validation depth ----------

  describe("POST validation", () => {
    const valid = {
      title: "New Lesson",
      url: "https://vid.com/new",
      cover_image_url: "https://img.com/new",
      description: "desc",
      duration_minutes: 30,
    };

    function mockInsertChain() {
      const q = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "x", ...valid, event_id: "event-1" },
          error: null,
        }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });
      return q;
    }

    it("rejects negative duration_minutes", async () => {
      mockInsertChain();
      const res = await POST(
        makeRequest({ ...valid, duration_minutes: -5 }) as never
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-integer duration_minutes", async () => {
      mockInsertChain();
      const res = await POST(
        makeRequest({ ...valid, duration_minutes: 3.5 }) as never
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty title", async () => {
      mockInsertChain();
      const res = await POST(makeRequest({ ...valid, title: "" }) as never);
      expect(res.status).toBe(400);
    });

    it("rejects title longer than 500 chars", async () => {
      mockInsertChain();
      const res = await POST(
        makeRequest({ ...valid, title: "a".repeat(501) }) as never
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty description", async () => {
      mockInsertChain();
      const res = await POST(
        makeRequest({ ...valid, description: "" }) as never
      );
      expect(res.status).toBe(400);
    });

    it("rejects extra keys (.strict())", async () => {
      mockInsertChain();
      const res = await POST(
        makeRequest({ ...valid, injected: "evil" }) as never
      );
      expect(res.status).toBe(400);
    });

    it("returns 500 when Supabase insert returns an error", async () => {
      const q = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "db blew up" },
        }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });
      const res = await POST(makeRequest(valid) as never);
      expect(res.status).toBe(500);
    });

    it("propagates 403 when authorizeAgentEventAccess denies", async () => {
      // Must be a (mocked) NextResponse for the `instanceof` check in the
      // route to hit. A plain object would fail through and the update would
      // proceed — which is actually the bug class this test guards against.
      const accessErr = NextResponse.json({ error: "forbidden" }, { status: 403 });
      (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(accessErr);
      const res = await POST(makeRequest(valid) as never);
      expect(res).toBe(accessErr);
    });
  });

  // ---------- Cross-event protection ----------

  describe("cross-event protection", () => {
    const validLessonId = "11111111-2222-4333-8444-555555555555";

    it("PATCH returns 404 when lesson_id is not in this event", async () => {
      // Supabase .single() on no matching rows returns PGRST116
      const q = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "no rows" },
        }),
      };
      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });

      const res = await PATCH(
        makeRequest({ lesson_id: validLessonId, title: "X" }) as never
      );
      expect(res.status).toBe(404);
    });

    it("DELETE returns 404 when lesson_id is not in this event", async () => {
      // Pre-existence check returns no rows
      const selectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      selectQuery.eq = jest
        .fn()
        .mockReturnValueOnce(selectQuery)
        .mockResolvedValueOnce({ data: [], error: null });

      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(selectQuery),
      });

      const res = await DELETE(
        makeRequest(undefined, { lesson_id: validLessonId }) as never
      );
      expect(res.status).toBe(404);
    });
  });
});
