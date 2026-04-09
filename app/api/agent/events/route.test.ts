/** @jest-environment jsdom */

import { GET } from "./route";
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
