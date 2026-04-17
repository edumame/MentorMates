/** @jest-environment jsdom */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { authenticateAgentRequest, authorizeAgentEventAccess, generateApiKey, hashApiKey } from "./auth";

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

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("Agent API Key Auth", () => {
  describe("generateApiKey", () => {
    it("generates a key with mm_sk_ prefix", () => {
      const { raw, hash, prefix } = generateApiKey();
      expect(raw).toMatch(/^mm_sk_[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64); // SHA-256 hex
      expect(prefix).toBe(raw.slice(0, 14));
    });

    it("generates unique keys each time", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1.raw).not.toBe(key2.raw);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe("hashApiKey", () => {
    it("produces consistent hashes", () => {
      const key = "mm_sk_test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different keys", () => {
      const hash1 = hashApiKey("mm_sk_key1");
      const hash2 = hashApiKey("mm_sk_key2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("authenticateAgentRequest", () => {
    const mockKeyLookup = (
      keyRow: Record<string, unknown> | null,
      options?: {
        isAdmin?: boolean;
        ownerEvents?: Array<{ event_id: string; event_name: string | null }>;
        organizerRoleEventIds?: string[];
        organizerEvents?: Array<{ event_id: string; event_name: string | null }>;
        slugEvent?: { event_id: string } | null;
      }
    ) => {
      const agentKeySelectQuery = {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: keyRow,
          error: null,
        }),
      };
      const updateQuery = {
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      const ownerEventsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: options?.ownerEvents ?? [],
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
          data: (options?.organizerRoleEventIds ?? []).map((event_id) => ({ event_id })),
          error: null,
        });
      const organizerEventsQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: options?.organizerEvents ?? [],
          error: null,
        }),
      };
      const slugEventQuery = {
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: options?.slugEvent ?? null,
          error: null,
        }),
      };
      let eventsFromCalls = 0;
      const from = jest.fn((table: string) => {
        if (table === "agent_api_keys") {
          return {
            select: jest.fn().mockReturnValue(agentKeySelectQuery),
            update: jest.fn().mockReturnValue(updateQuery),
          };
        }
        if (table === "events") {
          if (options && "slugEvent" in options) {
            return slugEventQuery;
          }
          eventsFromCalls += 1;
          return eventsFromCalls === 1 ? ownerEventsQuery : organizerEventsQuery;
        }
        if (table === "user_event_roles") {
          return organizerRolesQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      const rpc = jest.fn().mockResolvedValue({
        data: options?.isAdmin ?? false,
        error: null,
      });

      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from,
        rpc,
      });
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("uses the request event_id for reusable keys", async () => {
      mockKeyLookup({
        id: "key-1",
        user_id: "user-1",
        event_id: null,
        scopes: ["event:read"],
        expires_at: null,
        revoked_at: null,
      });

      const result = await authenticateAgentRequest({
        headers: { get: () => "Bearer mm_sk_1234567890abcdef" },
        nextUrl: new URL("https://mentormates.ai/api/agent/events?event_id=22222222-2222-4222-8222-222222222222"),
      } as never);

      expect(result).toEqual({
        userId: "user-1",
        eventId: "22222222-2222-4222-8222-222222222222",
        scopes: ["event:read"],
        keyId: "key-1",
      });
    });

    it("requires event_id for reusable keys by default", async () => {
      mockKeyLookup({
        id: "key-1",
        user_id: "user-1",
        event_id: null,
        scopes: ["event:read"],
        expires_at: null,
        revoked_at: null,
      });

      const result = await authenticateAgentRequest({
        headers: { get: () => "Bearer mm_sk_1234567890abcdef" },
        nextUrl: new URL("https://mentormates.ai/api/agent/events"),
      } as never);

      expect(result).toMatchObject({ status: 400 });
      if ("status" in result) {
        await expect(result.json()).resolves.toEqual({
          error: "event_id or event_slug query parameter is required",
        });
      }
    });

    it("uses event_slug for reusable keys", async () => {
      mockKeyLookup(
        {
          id: "key-1",
          user_id: "user-1",
          event_id: null,
          scopes: ["event:read"],
          expires_at: null,
          revoked_at: null,
        },
        {
          slugEvent: {
            event_id: "22222222-2222-4222-8222-222222222222",
          },
        }
      );

      const result = await authenticateAgentRequest({
        headers: { get: () => "Bearer mm_sk_1234567890abcdef" },
        nextUrl: new URL(
          "https://mentormates.ai/api/agent/events?event_slug=student-hackathon"
        ),
      } as never);

      expect(result).toEqual({
        userId: "user-1",
        eventId: "22222222-2222-4222-8222-222222222222",
        scopes: ["event:read"],
        keyId: "key-1",
      });
    });

    it("allows a missing event_id when explicitly requested by the caller", async () => {
      mockKeyLookup({
        id: "key-1",
        user_id: "user-1",
        event_id: null,
        scopes: ["event:read"],
        expires_at: null,
        revoked_at: null,
      });

      const result = await authenticateAgentRequest(
        {
          headers: { get: () => "Bearer mm_sk_1234567890abcdef" },
          nextUrl: new URL("https://mentormates.ai/api/agent/events"),
        } as never,
        { allowMissingEventId: true }
      );

      expect(result).toEqual({
        userId: "user-1",
        eventId: "",
        scopes: ["event:read"],
        keyId: "key-1",
      });
    });

    it("rejects using a scoped key against a different event", async () => {
      mockKeyLookup({
        id: "key-1",
        user_id: "user-1",
        event_id: "11111111-1111-4111-8111-111111111111",
        scopes: ["event:read"],
        expires_at: null,
        revoked_at: null,
      });

      const result = await authenticateAgentRequest({
        headers: { get: () => "Bearer mm_sk_1234567890abcdef" },
        nextUrl: new URL("https://mentormates.ai/api/agent/events?event_id=22222222-2222-4222-8222-222222222222"),
      } as never);

      expect(result).toMatchObject({ status: 403 });
      if ("status" in result) {
        await expect(result.json()).resolves.toEqual({
          error: "This API key is scoped to a different event",
        });
      }
    });
  });

  describe("authorizeAgentEventAccess", () => {
    const mockSupabase = () => {
      const eventQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      };
      const roleQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      };
      const from = jest.fn((table: string) => {
        if (table === "events") return eventQuery;
        if (table === "user_event_roles") return roleQuery;
        throw new Error(`Unexpected table: ${table}`);
      });
      const rpc = jest.fn();

      (createSupabaseServiceClient as jest.Mock).mockReturnValue({
        from,
        rpc,
      });

      return { eventQuery, roleQuery, rpc };
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("allows organizer access when the key owner is still an organizer", async () => {
      const { eventQuery, roleQuery, rpc } = mockSupabase();
      eventQuery.maybeSingle.mockResolvedValue({
        data: { owner_id: "owner-1" },
        error: null,
      });
      roleQuery.maybeSingle.mockResolvedValue({
        data: { role: EventRole.Organizer },
        error: null,
      });
      rpc.mockResolvedValue({ data: false, error: null });

      const result = await authorizeAgentEventAccess({
        userId: "user-1",
        eventId: "event-1",
        scopes: [],
        keyId: "key-1",
      });

      expect(result).toEqual({
        eventId: "event-1",
        isAdmin: false,
        isOwner: false,
        userRole: EventRole.Organizer,
      });
    });

    it("allows participant access when the caller only needs participant permissions", async () => {
      const { eventQuery, roleQuery, rpc } = mockSupabase();
      eventQuery.maybeSingle.mockResolvedValue({
        data: { owner_id: "owner-1" },
        error: null,
      });
      roleQuery.maybeSingle.mockResolvedValue({
        data: { role: EventRole.Participant },
        error: null,
      });
      rpc.mockResolvedValue({ data: false, error: null });

      const result = await authorizeAgentEventAccess(
        {
          userId: "user-1",
          eventId: "event-1",
          scopes: [],
          keyId: "key-1",
        },
        EventRole.Participant
      );

      expect(result).toEqual({
        eventId: "event-1",
        isAdmin: false,
        isOwner: false,
        userRole: EventRole.Participant,
      });
    });

    it("allows owner access even without a user_event_roles row", async () => {
      const { eventQuery, roleQuery, rpc } = mockSupabase();
      eventQuery.maybeSingle.mockResolvedValue({
        data: { owner_id: "user-1" },
        error: null,
      });
      roleQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      rpc.mockResolvedValue({ data: false, error: null });

      const result = await authorizeAgentEventAccess({
        userId: "user-1",
        eventId: "event-1",
        scopes: [],
        keyId: "key-1",
      });

      expect(result).toEqual({
        eventId: "event-1",
        isAdmin: false,
        isOwner: true,
        userRole: null,
      });
    });

    it("returns a 403 response when the key owner lost organizer access", async () => {
      const { eventQuery, roleQuery, rpc } = mockSupabase();
      eventQuery.maybeSingle.mockResolvedValue({
        data: { owner_id: "owner-1" },
        error: null,
      });
      roleQuery.maybeSingle.mockResolvedValue({
        data: { role: EventRole.Participant },
        error: null,
      });
      rpc.mockResolvedValue({ data: false, error: null });

      const result = await authorizeAgentEventAccess({
        userId: "user-1",
        eventId: "event-1",
        scopes: [],
        keyId: "key-1",
      });

      expect(result).toMatchObject({ status: 403 });
      if ("status" in result) {
        expect(result.status).toBe(403);
        await expect(result.json()).resolves.toEqual({
          error: "The API key owner no longer has permission to access this event",
        });
      }
    });
  });
});
