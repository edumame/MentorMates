/** @jest-environment jsdom */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { authorizeAgentEventAccess, generateApiKey, hashApiKey } from "./auth";

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
