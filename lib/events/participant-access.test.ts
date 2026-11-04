import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import {
  countReservedParticipantSeats,
  joinParticipantEvent,
} from "./participant-access";

describe("joinParticipantEvent", () => {
  const maybeSingleResult = (result: { data: unknown; error: unknown }) => ({
    overrideTypes: jest.fn().mockResolvedValue(result),
  });

  it("blocks paid events for agent joins", async () => {
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              maybeSingleResult({
                data: {
                  event_id: "event-1",
                  event_name: "Paid Event",
                  visibility: "public",
                  approval_status: "approved",
                  require_participant_approval: false,
                  participant_capacity: null,
                  paid: true,
                },
                error: null,
              }),
            ),
          })),
        })),
      })),
    } as unknown as ServiceSupabaseClient;

    const result = await joinParticipantEvent(
      supabase,
      {
        eventId: "event-1",
        userId: "user-1",
        channel: "agent",
      }
    );

    expect(result).toEqual({
      status: "error",
      httpStatus: 403,
      payload: {
        error: "Paid events cannot be joined through the agent API.",
      },
    });
  });

  it("joins an unpaid public event without approval", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  maybeSingleResult({
                    data: {
                      event_id: "event-1",
                      event_name: "Free Event",
                      visibility: "public",
                      approval_status: "approved",
                      require_participant_approval: false,
                      participant_capacity: null,
                      paid: false,
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        }

        if (table === "user_event_roles") {
          return {
            select: jest.fn((columns: string) => {
              if (columns === "role") {
                return {
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      maybeSingle: jest.fn(() =>
                        maybeSingleResult({
                          data: null,
                          error: null,
                        }),
                      ),
                    })),
                  })),
                };
              }

              return {
                eq: jest.fn(() => ({
                  eq: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                  }),
                })),
              };
            }),
            upsert,
          };
        }

        if (table === "event_intake_form_bindings") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn(() =>
                          maybeSingleResult({
                            data: null,
                            error: null,
                          }),
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as ServiceSupabaseClient;

    const result = await joinParticipantEvent(
      supabase,
      {
        eventId: "event-1",
        userId: "user-1",
        channel: "agent",
      }
    );

    expect(result).toEqual({
      status: "joined",
      requiresApproval: false,
      requestStatus: "joined",
      message: "Joined Free Event as a participant",
    });
    expect(upsert).toHaveBeenCalled();
  });
});

describe("joinParticipantEvent on a full event", () => {
  const buildFullEventClient = ({
    paid,
    payment,
  }: {
    paid: boolean;
    payment: { payment_status: string } | null;
  }) => {
    const maybeSingle = (data: unknown) => ({
      overrideTypes: jest.fn().mockResolvedValue({ data, error: null }),
    });
    const chain = (terminal: Record<string, unknown>) => {
      const builder: Record<string, unknown> = { ...terminal };
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn(() => builder);
      return builder;
    };

    return {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return chain({
            maybeSingle: () =>
              maybeSingle({
                event_id: "event-1",
                event_name: "Full Event",
                require_participant_approval: true,
                participant_capacity: 1,
                paid,
              }),
          });
        }
        if (table === "user_event_roles") {
          return chain({
            maybeSingle: () => maybeSingle(null),
            then: (resolve: (value: unknown) => unknown) =>
              resolve({ count: 1, error: null }),
          });
        }
        if (table === "user_event_payments") {
          return chain({ maybeSingle: () => maybeSingle(payment) });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServiceSupabaseClient;
  };

  const join = (supabase: ServiceSupabaseClient) =>
    joinParticipantEvent(supabase, {
      eventId: "event-1",
      userId: "bob",
      channel: "web",
    });

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("flags a charged user for a refund instead of a bare full error", async () => {
    const result = await join(
      buildFullEventClient({
        paid: true,
        payment: { payment_status: "paid" },
      }),
    );

    expect(result).toEqual({
      status: "error",
      httpStatus: 409,
      payload: {
        error: expect.stringContaining("refund"),
        refund_required: true,
      },
    });
  });

  it("keeps the plain full error for a user who has not paid", async () => {
    const result = await join(
      buildFullEventClient({ paid: true, payment: null }),
    );

    expect(result).toEqual({
      status: "error",
      httpStatus: 409,
      payload: { error: "Event is full. No seats available." },
    });
  });

  it("keeps the plain full error on free events", async () => {
    const result = await join(
      buildFullEventClient({ paid: false, payment: null }),
    );

    expect(result).toEqual({
      status: "error",
      httpStatus: 409,
      payload: { error: "Event is full. No seats available." },
    });
  });
});

describe("countReservedParticipantSeats", () => {
  const rows = (ids: string[]) => ids.map((user_id) => ({ user_id }));

  const buildClient = (tables: Record<string, unknown[]>, error?: unknown) => {
    const range = jest.fn();
    const client = {
      from: jest.fn((table: string) => {
        const builder: Record<string, unknown> = {};
        builder.select = jest.fn(() => builder);
        builder.eq = jest.fn(() => builder);
        builder.order = jest.fn(() => builder);
        builder.range = jest.fn(async (from: number, to: number) => {
          range(table, from, to);
          return {
            data: error ? null : tables[table].slice(from, to + 1),
            error: error ?? null,
          };
        });
        return builder;
      }),
    } as unknown as ServiceSupabaseClient;

    return { client, range };
  };

  it("counts approved users who have not joined on paid events", async () => {
    const { client } = buildClient({
      user_event_roles: rows(["alice"]),
      participant_approval_requests: rows(["alice", "bob", "carol"]),
    });

    await expect(
      countReservedParticipantSeats(client, { eventId: "event-1", paid: true }),
    ).resolves.toBe(3);
  });

  it("ignores approved requests on free events", async () => {
    const { client } = buildClient({
      user_event_roles: rows(["alice"]),
      participant_approval_requests: rows(["bob"]),
    });

    await expect(
      countReservedParticipantSeats(client, {
        eventId: "event-1",
        paid: false,
      }),
    ).resolves.toBe(1);
    expect(client.from).not.toHaveBeenCalledWith(
      "participant_approval_requests",
    );
  });

  it("leaves out the excluded user", async () => {
    const { client } = buildClient({
      user_event_roles: rows(["alice"]),
      participant_approval_requests: rows(["bob"]),
    });

    await expect(
      countReservedParticipantSeats(client, {
        eventId: "event-1",
        paid: true,
        excludeUserId: "bob",
      }),
    ).resolves.toBe(1);
  });

  it("reads past the API row limit", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `user-${index}`);
    const { client, range } = buildClient({
      user_event_roles: rows(ids),
      participant_approval_requests: [],
    });

    await expect(
      countReservedParticipantSeats(client, { eventId: "event-1", paid: true }),
    ).resolves.toBe(1001);
    expect(range).toHaveBeenCalledWith("user_event_roles", 1000, 1999);
  });

  it("throws rather than undercounting when a query fails", async () => {
    const { client } = buildClient({}, { message: "boom" });

    await expect(
      countReservedParticipantSeats(client, { eventId: "event-1", paid: true }),
    ).rejects.toThrow("Failed to count reserved seats");
  });
});
