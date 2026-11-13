/** @jest-environment node */

import type { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isParticipantSeatAvailable } from "@/lib/events/participant-access";
import {
  createSeatStore,
  type SeatStoreSeed,
} from "@/lib/events/__fixtures__/seat-store";
import { DELETE } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("DELETE /api/events/[eventId]/registration", () => {
  const useStore = (
    seed: Partial<SeatStoreSeed> = {},
    user: { id: string } | null = { id: "alice" },
  ) => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      roles: { alice: "participant" },
      requests: { alice: "approved" },
      ...seed,
    });

    (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      from: store.client.from,
      auth: {
        getUser: jest.fn(async () => ({ data: { user }, error: null })),
      },
    });

    return store;
  };

  const cancel = (eventId: string, body: unknown = { role: "participant" }) =>
    DELETE(
      { json: async () => body } as unknown as NextRequest,
      { params: Promise.resolve({ eventId }) },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("gives the seat back when a paid participant cancels", async () => {
    const store = useStore();

    const response = await cancel(store.eventId);

    expect(response.status).toBe(200);
    expect(store.roleOf("alice")).toBeUndefined();
    expect(store.requestStatusOf("alice")).toBe("withdrawn");
    await expect(
      isParticipantSeatAvailable(store.client, {
        eventId: store.eventId,
        userId: "bob",
      }),
    ).resolves.toBe(true);
  });

  it("keeps a free event's approval so the user can rejoin", async () => {
    const store = useStore({ paid: false });

    const response = await cancel(store.eventId);

    expect(response.status).toBe(200);
    expect(store.roleOf("alice")).toBeUndefined();
    expect(store.requestStatusOf("alice")).toBe("approved");
  });

  it("only removes the signed-in user", async () => {
    const store = useStore({
      participantCapacity: 2,
      roles: { alice: "participant", bob: "participant" },
      requests: { alice: "approved", bob: "approved" },
    });

    await cancel(store.eventId);

    expect(store.roleOf("bob")).toBe("participant");
    expect(store.requestStatusOf("bob")).toBe("approved");
  });

  it("rejects a signed-out caller and changes nothing", async () => {
    const store = useStore({}, null);

    const response = await cancel(store.eventId);

    expect(response.status).toBe(401);
    expect(store.roleOf("alice")).toBe("participant");
    expect(store.requestStatusOf("alice")).toBe("approved");
  });

  it("keeps the role when the reservation cannot be released", async () => {
    const store = useStore({ failingTables: ["participant_approval_requests"] });

    const response = await cancel(store.eventId);

    expect(response.status).toBe(500);
    expect(store.roleOf("alice")).toBe("participant");
  });

  it("reports a failure when the role cannot be deleted", async () => {
    const store = useStore({ failingTables: ["user_event_roles"] });

    const response = await cancel(store.eventId);

    expect(response.status).toBe(400);
  });

  it("rejects a request without a valid role and changes nothing", async () => {
    const store = useStore();

    const response = await cancel(store.eventId, { role: "superuser" });

    expect(response.status).toBe(400);
    expect(store.roleOf("alice")).toBe("participant");
    expect(store.requestStatusOf("alice")).toBe("approved");
  });

  it("does not touch the approval when a non-participant role is cancelled", async () => {
    const store = useStore({
      roles: { alice: "mentor" },
      requests: { alice: "approved" },
    });

    const response = await cancel(store.eventId, { role: "mentor" });

    expect(response.status).toBe(200);
    expect(store.roleOf("alice")).toBeUndefined();
    expect(store.requestStatusOf("alice")).toBe("approved");
  });
});
