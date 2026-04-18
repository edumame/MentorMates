/** @jest-environment jsdom */

import { GET, POST, PATCH, DELETE } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
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
      // Supabase query builder is chainable + thenable; .delete().eq().eq() resolves.
      const q: {
        delete: jest.Mock;
        eq: jest.Mock;
      } = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(),
      };
      q.eq
        .mockReturnValueOnce(q) // first .eq() returns the chain
        .mockResolvedValueOnce({ error: null }); // second .eq() resolves

      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(q),
      });

      const res = await DELETE(
        makeRequest(undefined, { lesson_id: "11111111-2222-4333-8444-555555555555" }) as never
      );
      expect(res.status).toBe(200);
      expect(q.delete).toHaveBeenCalled();
    });

    it("rejects DELETE without lesson_id", async () => {
      const res = await DELETE(makeRequest(undefined) as never);
      expect(res.status).toBe(400);
    });
  });
});
