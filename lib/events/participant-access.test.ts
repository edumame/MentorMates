import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import {
  countReservedParticipantSeats,
  isParticipantSeatAvailable,
  joinParticipantEvent,
  releaseParticipantSeatReservation,
} from "./participant-access";
import { createSeatStore } from "./__fixtures__/seat-store";

function harness(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  const event = { event_id: "event-1", event_name: "Fixture", visibility: "public", approval_status: "approved",
    paid: false, require_participant_approval: false, participant_capacity: null, ...overrides };
  const insert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn((table: string) => {
    const q: Record<string, jest.Mock> = {};
    for (const method of ["select", "eq", "order", "limit", "maybeSingle", "single"]) q[method] = jest.fn(() => q);
    q.overrideTypes = jest.fn().mockResolvedValue({ data: table === "events" ? event : data[table] ?? null, error: null });
    q.insert = insert;
    return q;
  });
  return { client: { from } as unknown as ServiceSupabaseClient, from, insert };
}
const options = { eventId: "event-1", userId: "user-1", channel: "web" as const };

describe("participant enrollment requirements", () => {
  it("joins free approved events with an insert that cannot overwrite a concurrent staff role", async () => {
    const h = harness();
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "participant", user_id: "user-1" }));
  });
  it.each([true, false])("requires paid entitlement independently of approval configuration (%s)", async (approval) => {
    const h = harness({ paid: true, require_participant_approval: approval }, {
      participant_approval_requests: approval ? { id: "request", status: "approved" } : null,
    });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 402 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("allows paid entitlement after all independent requirements", async () => {
    const h = harness({ paid: true }, { user_event_payments: { payment_status: "paid" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
  });
  it.each([
    { visibility: "draft", approval_status: "approved" },
    { visibility: "public", approval_status: "submitted" },
    { visibility: "private", approval_status: "rejected" },
    { visibility: "archived", approval_status: "approved" },
    { visibility: "archived", approval_status: "not_submitted" },
  ])("rejects closed enrollment state %o before mutation", async (state) => {
    const h = harness(state);
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 403 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("rejects agent joins of archived events before mutation (XL-001)", async () => {
    const h = harness({ visibility: "archived", approval_status: "approved" });
    expect(await joinParticipantEvent(h.client, { ...options, channel: "agent" })).toMatchObject({ status: "error", httpStatus: 403 });
    expect(h.insert).not.toHaveBeenCalled();
  });
  it("preserves private non-listed events without requiring public-listing approval", async () => {
    const h = harness({ visibility: "private", approval_status: "not_submitted" });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
  });
  it("blocks agent access to paid or password-protected events", async () => {
    for (const h of [harness({ paid: true }), harness({}, { role_passwords: { role: "participant" } })]) {
      expect(await joinParticipantEvent(h.client, { ...options, channel: "agent" })).toMatchObject({ status: "error", httpStatus: 403 });
      expect(h.insert).not.toHaveBeenCalled();
    }
  });
  it("maps the serialized capacity rejection to a conflict", async () => {
    const h = harness(); h.insert.mockResolvedValue({ error: { code: "45000" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 409 });
  });
  it("preserves a concurrently assigned role", async () => {
    const h = harness(); h.insert.mockResolvedValue({ error: { code: "23505" } });
    expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 409 });
  });
  describe("registration questionnaire version (ORG-010)", () => {
    const binding = { event_intake_form_bindings: { form_version_id: "v2" } };
    it("requires a submission when a registration form is active", async () => {
      const h = harness({}, binding);
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "error", httpStatus: 412 });
      expect(h.insert).not.toHaveBeenCalled();
    });
    it("rejects a submission for an older form version", async () => {
      const h = harness({}, { ...binding, intake_form_submissions: { id: "s1", form_version_id: "v1" } });
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({
        status: "error",
        httpStatus: 412,
        payload: expect.objectContaining({ questionnaire_outdated: true }),
      });
      expect(h.insert).not.toHaveBeenCalled();
    });
    it("joins with a submission for the active form version", async () => {
      const h = harness({}, { ...binding, intake_form_submissions: { id: "s1", form_version_id: "v2" } });
      expect(await joinParticipantEvent(h.client, options)).toMatchObject({ status: "joined" });
    });
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
  const rows = (ids: string[]) =>
    ids.map((user_id) => ({ user_id, role: "participant" }));

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

describe("countReservedParticipantSeats with stale approvals", () => {
  it("does not hold a seat for an approved user who took another role", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: true,
      roles: { alice: "mentor" },
      requests: { alice: "approved" },
    });

    await expect(
      countReservedParticipantSeats(client, { eventId, paid: true }),
    ).resolves.toBe(0);
  });

  it("does not count mentors as participants", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: false,
      roles: { alice: "mentor", bob: "participant" },
    });

    await expect(
      countReservedParticipantSeats(client, { eventId, paid: false }),
    ).resolves.toBe(1);
  });

  it("does not hold a seat for a withdrawn request", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { alice: "withdrawn" },
    });

    await expect(
      countReservedParticipantSeats(client, { eventId, paid: true }),
    ).resolves.toBe(0);
  });
});

describe("isParticipantSeatAvailable", () => {
  it("is always true without a capacity limit", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: null,
      paid: true,
      roles: { alice: "participant" },
    });

    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).resolves.toBe(true);
  });

  it("is false when other users hold every seat", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { alice: "approved" },
    });

    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).resolves.toBe(false);
  });

  it("does not count the user's own reservation against them", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { bob: "approved" },
    });

    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).resolves.toBe(true);
  });

  it("treats a capacity of zero as full", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 0,
      paid: true,
    });

    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).resolves.toBe(false);
  });

  it("throws when the event cannot be read", async () => {
    const { client, eventId } = createSeatStore({
      participantCapacity: 1,
      paid: true,
      failingTables: ["events"],
    });

    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).rejects.toThrow("Failed to verify event capacity");
  });
});

describe("releaseParticipantSeatReservation", () => {
  it("frees the seat held by an approved user on a paid event", async () => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { alice: "approved" },
    });
    const { client, eventId } = store;

    await releaseParticipantSeatReservation(client, {
      eventId,
      userId: "alice",
    });

    expect(store.requestStatusOf("alice")).toBe("withdrawn");
    await expect(
      isParticipantSeatAvailable(client, { eventId, userId: "bob" }),
    ).resolves.toBe(true);
  });

  it("leaves other users' reservations alone", async () => {
    const store = createSeatStore({
      participantCapacity: 2,
      paid: true,
      requests: { alice: "approved", bob: "approved" },
    });

    await releaseParticipantSeatReservation(store.client, {
      eventId: store.eventId,
      userId: "alice",
    });

    expect(store.requestStatusOf("bob")).toBe("approved");
  });

  it.each(["pending", "rejected", "withdrawn"])(
    "does not touch a %s request",
    async (status) => {
      const store = createSeatStore({
        participantCapacity: 1,
        paid: true,
        requests: { alice: status },
      });

      await releaseParticipantSeatReservation(store.client, {
        eventId: store.eventId,
        userId: "alice",
      });

      expect(store.requestStatusOf("alice")).toBe(status);
    },
  );

  it("keeps approvals on free events, where they hold no seat", async () => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: false,
      requests: { alice: "approved" },
    });

    await releaseParticipantSeatReservation(store.client, {
      eventId: store.eventId,
      userId: "alice",
    });

    expect(store.requestStatusOf("alice")).toBe("approved");
  });

  it.each(["events", "participant_approval_requests"])(
    "throws when %s cannot be reached",
    async (table) => {
      const { client, eventId } = createSeatStore({
        participantCapacity: 1,
        paid: true,
        requests: { alice: "approved" },
        failingTables: [table],
      });

      await expect(
        releaseParticipantSeatReservation(client, { eventId, userId: "alice" }),
      ).rejects.toThrow("Failed to release seat reservation");
    },
  );
});

describe("joinParticipantEvent after withdrawing", () => {
  const buildClient = (updateError: unknown = null) => {
    const single = (data: unknown) => ({
      overrideTypes: jest.fn().mockResolvedValue({ data, error: null }),
    });
    const update = jest.fn();
    const chain = (terminal: Record<string, unknown>) => {
      const builder: Record<string, unknown> = { ...terminal };
      builder.select = jest.fn(() => builder);
      builder.eq = jest.fn(() => builder);
      builder.order = jest.fn(() => builder);
      builder.limit = jest.fn(() => builder);
      return builder;
    };
    const client = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return chain({
            maybeSingle: () =>
              single({
                event_id: "event-1",
                event_name: "Paid Event",
                require_participant_approval: true,
                participant_capacity: null,
                paid: true,
              }),
          });
        }
        if (table === "participant_approval_requests") {
          return chain({
            maybeSingle: () => single({ id: "request-1", status: "withdrawn" }),
            update: (values: unknown) => {
              update(values);
              return { eq: jest.fn(async () => ({ error: updateError })) };
            },
          });
        }
        return chain({ maybeSingle: () => single(null) });
      }),
    } as unknown as ServiceSupabaseClient;

    return { client, update };
  };

  const join = (client: ServiceSupabaseClient) =>
    joinParticipantEvent(client, {
      eventId: "event-1",
      userId: "alice",
      channel: "web",
    });

  it("sends the request back for review rather than locking the user out", async () => {
    const { client, update } = buildClient();

    await expect(join(client)).resolves.toMatchObject({
      status: "approval_requested",
      requestId: "request-1",
      requestStatus: "pending",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      }),
    );
  });

  it("reports a failure when the request cannot be reopened", async () => {
    const { client } = buildClient({ message: "boom" });

    await expect(join(client)).resolves.toMatchObject({
      status: "error",
      httpStatus: 500,
    });
  });
});
