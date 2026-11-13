/** @jest-environment node */

import type { NextRequest } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  createSeatStore,
  type SeatStoreSeed,
} from "@/lib/events/__fixtures__/seat-store";
import { POST } from "./route";

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(),
  authorizeAgentEventAccess: jest.fn(),
  requireScope: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

describe("POST /api/agent/events/approval-requests capacity", () => {
  const useStore = (seed: Partial<SeatStoreSeed>) => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      ...seed,
    });
    const bobRequest = store
      .rows("participant_approval_requests")
      .find((row) => row.user_id === "bob");

    if (bobRequest) {
      bobRequest.id = REQUEST_ID;
    }

    (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "organizer",
      eventId: store.eventId,
      scopes: ["participants:write"],
      keyId: "key-1",
    });
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      eventId: store.eventId,
      isAdmin: false,
      isOwner: false,
      userRole: "organizer",
    });

    return store;
  };

  const review = (action: "approve" | "reject") =>
    POST({
      json: async () => ({ request_id: REQUEST_ID, action }),
    } as unknown as NextRequest);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (requireScope as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refuses to approve past capacity when an approved user has not paid yet", async () => {
    const store = useStore({
      requests: { alice: "approved", bob: "pending" },
    });

    const response = await review("approve");

    expect(response.status).toBe(409);
    expect(store.requestStatusOf("bob")).toBe("pending");
  });

  it("approves a paid request while a seat is free, without creating a role", async () => {
    const store = useStore({ requests: { bob: "pending" } });

    const response = await review("approve");

    expect(response.status).toBe(200);
    expect(store.requestStatusOf("bob")).toBe("approved");
    expect(store.roleOf("bob")).toBeUndefined();
  });

  it("approves once the earlier approved user has left", async () => {
    const store = useStore({
      requests: { alice: "withdrawn", bob: "pending" },
    });

    const response = await review("approve");

    expect(response.status).toBe(200);
    expect(store.requestStatusOf("bob")).toBe("approved");
  });

  it("refuses a free event at capacity", async () => {
    const store = useStore({
      paid: false,
      roles: { alice: "participant" },
      requests: { bob: "pending" },
    });

    const response = await review("approve");

    expect(response.status).toBe(409);
    expect(store.roleOf("bob")).toBeUndefined();
  });

  it("does not apply the participant limit to other requested roles", async () => {
    const store = useStore({
      requests: { alice: "approved", bob: "pending" },
    });
    store
      .rows("participant_approval_requests")
      .find((row) => row.user_id === "bob")!.requested_role = "mentor";

    const response = await review("approve");

    expect(response.status).toBe(200);
  });

  it("can still reject on a full event", async () => {
    const store = useStore({
      requests: { alice: "approved", bob: "pending" },
    });

    const response = await review("reject");

    expect(response.status).toBe(200);
    expect(store.requestStatusOf("bob")).toBe("rejected");
  });

  it("returns 409 when another approval takes the last seat first (database guard)", async () => {
    const store = useStore({ requests: { bob: "pending" } });
    const from = store.client.from;
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        const builder = from(table as never);
        if (table !== "participant_approval_requests") {
          return builder;
        }
        return {
          ...builder,
          update: () => ({
            eq: async () => ({
              data: null,
              error: {
                code: "45000",
                message: "Event is full. No seats available.",
              },
            }),
          }),
        };
      },
    });

    const response = await review("approve");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Event is at full capacity. Cannot approve more participants.",
    });
    expect(store.requestStatusOf("bob")).toBe("pending");
  });

  it("does not approve when capacity cannot be verified", async () => {
    const store = useStore({ requests: { bob: "pending" } });
    const from = store.client.from;
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === "user_event_roles") {
          throw new Error("boom");
        }
        return from(table as never);
      },
    });

    const response = await review("approve");

    expect(response.status).toBe(500);
    expect(store.requestStatusOf("bob")).toBe("pending");
  });
});
