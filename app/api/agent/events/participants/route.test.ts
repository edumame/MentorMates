/** @jest-environment jsdom */

import { PATCH } from "./route";
import { authenticateAgentRequest, authorizeAgentEventAccess, requireScope } from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { NextResponse } from "next/server";
import { isParticipantSeatAvailable } from "@/lib/events/participant-access";
import { createSeatStore } from "@/lib/events/__fixtures__/seat-store";

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

describe("PATCH /api/agent/events/participants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      eventId: "22222222-2222-4222-8222-222222222222",
      scopes: ["participants:write"],
      keyId: "key-1",
    });
    (requireScope as jest.Mock).mockReturnValue(null);
  });

  it("blocks non-admin keys from promoting a participant to organizer", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      eventId: "22222222-2222-4222-8222-222222222222",
      isAdmin: false,
      isOwner: false,
      userRole: EventRole.Organizer,
    });

    const targetRoleQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role: EventRole.Participant },
        error: null,
      }),
    };
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return {
            ...targetRoleQuery,
            update: updateQuery.update,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const request = {
      json: async () => ({
        user_id: "33333333-3333-4333-8333-333333333333",
        action: "change_role",
        role: EventRole.Organizer,
      }),
    };

    const response = await PATCH(request as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can modify organizer-level roles",
    });
    expect(updateQuery.update).not.toHaveBeenCalled();
  });

  it("blocks non-admin keys from removing an organizer", async () => {
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      eventId: "22222222-2222-4222-8222-222222222222",
      isAdmin: false,
      isOwner: false,
      userRole: EventRole.Organizer,
    });

    const targetRoleQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role: EventRole.Organizer },
        error: null,
      }),
    };
    const deleteQuery = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return {
            ...targetRoleQuery,
            delete: deleteQuery.delete,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const request = {
      json: async () => ({
        user_id: "44444444-4444-4444-8444-444444444444",
        action: "remove",
      }),
    };

    const response = await PATCH(request as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can modify organizer-level roles",
    });
    expect(deleteQuery.delete).not.toHaveBeenCalled();
  });
  it("asks for write access, so archived events are refused before any write (XL-001)", async () => {
    const archived = NextResponse.json(
      { error: "archived events are read-only; unarchive first" },
      { status: 409 }
    );
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue(archived);
    const from = jest.fn();
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from });

    const response = await PATCH({
      json: async () => ({
        user_id: "44444444-4444-4444-8444-444444444444",
        action: "remove",
      }),
    } as never);

    expect(authorizeAgentEventAccess).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "22222222-2222-4222-8222-222222222222" }),
      EventRole.Organizer,
      { intent: "write" }
    );
    expect(response).toBe(archived);
    expect(from).not.toHaveBeenCalled();
  });

  describe("seat reservations", () => {
    const alice = "33333333-3333-4333-8333-333333333333";
    const bob = "44444444-4444-4444-8444-444444444444";

    const patch = (body: Record<string, unknown>) =>
      PATCH({ json: async () => ({ user_id: alice, ...body }) } as never);

    const useStore = (failingTables?: string[]) => {
      const store = createSeatStore({
        participantCapacity: 1,
        paid: true,
        roles: { [alice]: EventRole.Participant },
        requests: { [alice]: "approved" },
        failingTables,
      });
      (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);
      (authenticateAgentRequest as jest.Mock).mockResolvedValue({
        userId: "11111111-1111-4111-8111-111111111111",
        eventId: store.eventId,
        scopes: ["participants:write"],
        keyId: "key-1",
      });
      (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
        eventId: store.eventId,
        isAdmin: false,
        isOwner: false,
        userRole: EventRole.Organizer,
      });
      return store;
    };

    it("frees the seat when a paid participant is removed", async () => {
      const store = useStore();

      const response = await patch({ action: "remove" });

      expect(response.status).toBe(200);
      expect(store.roleOf(alice)).toBeUndefined();
      expect(store.requestStatusOf(alice)).toBe("withdrawn");
      await expect(
        isParticipantSeatAvailable(store.client, {
          eventId: store.eventId,
          userId: bob,
        }),
      ).resolves.toBe(true);
    });

    it("frees the seat when a paid participant moves to another role", async () => {
      const store = useStore();

      const response = await patch({
        action: "change_role",
        role: EventRole.Mentor,
      });

      expect(response.status).toBe(200);
      await expect(
        isParticipantSeatAvailable(store.client, {
          eventId: store.eventId,
          userId: bob,
        }),
      ).resolves.toBe(true);
    });

    it("keeps the role when the reservation cannot be released", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      const store = useStore(["participant_approval_requests"]);

      const response = await patch({ action: "remove" });

      expect(response.status).toBe(500);
      expect(store.roleOf(alice)).toBe(EventRole.Participant);
    });
  });
});
