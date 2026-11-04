/** @jest-environment node */

import type { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isParticipantSeatAvailable } from "@/lib/events/participant-access";
import { createSeatStore } from "@/lib/events/__fixtures__/seat-store";
import { DELETE } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("DELETE /api/events/[eventId]/participants/[userId]", () => {
  const useStore = (failingTables?: string[]) => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      roles: { organizer: "organizer", alice: "participant" },
      requests: { alice: "approved" },
      failingTables,
    });

    (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      from: store.client.from,
      rpc: jest.fn(async () => ({ data: false })),
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "organizer" } },
          error: null,
        })),
      },
    });

    return store;
  };

  const remove = (eventId: string) =>
    DELETE(
      { json: async () => ({}) } as unknown as NextRequest,
      { params: Promise.resolve({ eventId, userId: "alice" }) },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("gives the seat back when an organizer removes a paid participant", async () => {
    const store = useStore();

    const response = await remove(store.eventId);

    expect(response?.status).toBe(200);
    expect(store.roleOf("alice")).toBeUndefined();
    expect(store.requestStatusOf("alice")).toBe("withdrawn");
    await expect(
      isParticipantSeatAvailable(store.client, {
        eventId: store.eventId,
        userId: "bob",
      }),
    ).resolves.toBe(true);
  });

  it("keeps the role when the reservation cannot be released", async () => {
    const store = useStore(["participant_approval_requests"]);

    const response = await remove(store.eventId);

    expect(response?.status).toBe(500);
    expect(store.roleOf("alice")).toBe("participant");
  });
});
