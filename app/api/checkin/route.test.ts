/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { GET } from "./route";

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const SCANNER = "scanner-user";
const TICKET_HOLDER = "ticket-holder";
const EVENT_A = "event-a";
const EVENT_B = "event-b";

type RoleRow = { event: string; user: string; role: string };

function mockSupabase({
  signedInUser = SCANNER,
  roles = [],
  isPlatformAdmin = false,
}: {
  signedInUser?: string | null;
  roles?: RoleRow[];
  isPlatformAdmin?: boolean;
}) {
  const from = jest.fn(() => {
    const filters: Record<string, string> = {};
    const lookup = async () => {
      const row = roles.find(
        (r) => r.event === filters.event_id && r.user === filters.user_id
      );
      return row
        ? { data: { role: row.role }, error: null }
        : { data: null, error: { message: "no rows" } };
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(function (this: unknown, column: string, value: string) {
        filters[column] = value;
        return this;
      }),
      single: jest.fn(lookup),
      maybeSingle: jest.fn(lookup),
    };
    return query;
  });

  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: signedInUser ? { id: signedInUser } : null },
        error: null,
      }),
    },
    from,
    rpc: jest.fn().mockResolvedValue({ data: isPlatformAdmin, error: null }),
  };
  mockCreateSupabaseClient.mockResolvedValue(client);
  return client;
}

function checkin(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return GET(new Request(`http://localhost/api/checkin?${query}`));
}

const ticketForEventA = { evt: EVENT_A, usr: TICKET_HOLDER };
const registeredForEventA: RoleRow = {
  event: EVENT_A,
  user: TICKET_HOLDER,
  role: "participant",
};

describe("GET /api/checkin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("checks in a registered ticket for an organizer of the scanning event", async () => {
    mockSupabase({
      roles: [
        registeredForEventA,
        { event: EVENT_A, user: SCANNER, role: "organizer" },
      ],
    });

    const response = await checkin({ event: EVENT_A, ...ticketForEventA });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Successfully checked in",
    });
  });

  it("allows an event admin and a platform admin to scan", async () => {
    mockSupabase({
      roles: [
        registeredForEventA,
        { event: EVENT_A, user: SCANNER, role: "admin" },
      ],
    });
    expect(
      (await checkin({ event: EVENT_A, ...ticketForEventA })).status
    ).toBe(200);

    mockSupabase({ roles: [registeredForEventA], isPlatformAdmin: true });
    expect(
      (await checkin({ event: EVENT_A, ...ticketForEventA })).status
    ).toBe(200);
  });

  it("rejects a signed-out caller", async () => {
    mockSupabase({ signedInUser: null, roles: [registeredForEventA] });

    const response = await checkin({ event: EVENT_A, ...ticketForEventA });

    expect(response.status).toBe(401);
  });

  it.each(["participant", "mentor", "judge"])(
    "rejects a %s of the scanning event",
    async (role) => {
      mockSupabase({
        roles: [
          registeredForEventA,
          { event: EVENT_A, user: SCANNER, role },
        ],
      });

      const response = await checkin({ event: EVENT_A, ...ticketForEventA });

      expect(response.status).toBe(403);
    }
  );

  it("rejects an organizer of a different event than the one being scanned for", async () => {
    mockSupabase({
      roles: [
        registeredForEventA,
        { event: EVENT_B, user: SCANNER, role: "organizer" },
      ],
    });

    const response = await checkin({ event: EVENT_A, ...ticketForEventA });

    expect(response.status).toBe(403);
  });

  it("rejects a valid ticket from another event at this event's door", async () => {
    mockSupabase({
      roles: [
        registeredForEventA,
        { event: EVENT_B, user: SCANNER, role: "organizer" },
      ],
    });

    const response = await checkin({ event: EVENT_B, ...ticketForEventA });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This ticket is for a different event",
    });
  });

  it("requires a scanning event", async () => {
    const client = mockSupabase({ roles: [registeredForEventA] });

    const response = await checkin(ticketForEventA);

    expect(response.status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects a ticket whose holder is not registered for the event", async () => {
    mockSupabase({
      roles: [{ event: EVENT_A, user: SCANNER, role: "organizer" }],
    });

    const response = await checkin({ event: EVENT_A, ...ticketForEventA });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "User is not registered for this event",
    });
  });
});
