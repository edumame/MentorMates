/** @jest-environment node */

import type { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseParticipantSeatReservation } from "@/lib/events/participant-access";
import { createSeatStore } from "@/lib/events/__fixtures__/seat-store";
import { PATCH } from "./route";

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

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult, onUpdate?: () => void) {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    update: jest.fn(() => {
      onUpdate?.();
      return builder;
    }),
  };

  for (const method of ["select", "eq", "order", "range"]) {
    builder[method] = jest.fn(() => builder);
  }

  return builder;
}

describe("PATCH approval request capacity", () => {
  const params = Promise.resolve({ eventId: "event-1", requestId: "request-1" });
  const approve = (eventId?: string) =>
    PATCH(
      { json: async () => ({ status: "approved" }) } as unknown as NextRequest,
      {
        params: eventId
          ? Promise.resolve({ eventId, requestId: "request-1" })
          : params,
      },
    );

  const mockEvent = ({
    paid,
    capacity,
    roles,
    approved,
    requestStatus = "pending",
  }: {
    paid: boolean;
    capacity: number;
    roles: string[];
    approved: string[];
    requestStatus?: string;
  }) => {
    const onUpdate = jest.fn();

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "organizer" } },
          error: null,
        })),
      },
      rpc: jest.fn(async () => ({ data: false })),
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return query({ data: { role: "organizer" }, error: null });
        }
        if (table === "participant_approval_requests") {
          return query(
            {
              data: {
                id: "request-1",
                user_id: "bob",
                requested_role: "participant",
                status: requestStatus,
              },
              error: null,
            },
            onUpdate,
          );
        }
        if (table === "events") {
          return query({
            data: { participant_capacity: capacity, paid },
            error: null,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "events") {
          return query({
            data: { participant_capacity: capacity, paid },
            error: null,
          });
        }
        return query({
          data: (table === "user_event_roles" ? roles : approved).map(
            (user_id) => ({ user_id, role: "participant" }),
          ),
          error: null,
        });
      }),
    });

    return { onUpdate };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses to approve past capacity when an approved user has not paid yet", async () => {
    const { onUpdate } = mockEvent({
      paid: true,
      capacity: 1,
      roles: [],
      approved: ["alice"],
    });

    const response = await approve();

    expect(response.status).toBe(409);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("approves a paid request while a seat is still free", async () => {
    const { onUpdate } = mockEvent({
      paid: true,
      capacity: 2,
      roles: [],
      approved: ["alice"],
    });

    const response = await approve();

    expect(response.status).toBe(200);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("does not count a paid user who already joined twice", async () => {
    mockEvent({
      paid: true,
      capacity: 2,
      roles: ["alice"],
      approved: ["alice"],
    });

    const response = await approve();

    expect(response.status).toBe(200);
  });

  it("does not count the user being re-approved against themselves", async () => {
    mockEvent({
      paid: true,
      capacity: 1,
      roles: [],
      approved: ["bob"],
      requestStatus: "approved",
    });

    const response = await approve();

    expect(response.status).toBe(200);
  });

  it("approves the next user once the approved holder has left", async () => {
    const { onUpdate } = mockEvent({
      paid: true,
      capacity: 1,
      roles: [],
      approved: [],
    });
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { alice: "approved" },
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);

    expect((await approve(store.eventId)).status).toBe(409);
    expect(onUpdate).not.toHaveBeenCalled();

    await releaseParticipantSeatReservation(store.client, {
      eventId: store.eventId,
      userId: "alice",
    });

    expect((await approve(store.eventId)).status).toBe(200);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("still refuses a free event at capacity", async () => {
    mockEvent({ paid: false, capacity: 1, roles: ["alice"], approved: [] });

    const response = await approve();

    expect(response.status).toBe(409);
  });
});
