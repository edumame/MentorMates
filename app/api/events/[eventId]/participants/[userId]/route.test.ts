/** @jest-environment jsdom */

import { DELETE } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { joinParticipantEvent } from "@/lib/events/participant-access";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

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

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type TableError = { message: string } | null;

const EVENT_ID = "event-1";
const ORGANIZER_ID = "organizer-1";
const TARGET_ID = "participant-1";

/**
 * In-memory stand-in for the slice of the Supabase query builder these flows
 * use. Keeping the rows stateful lets a test run removal and then a rejoin
 * against the same data. `failures` makes a write to that table return an error.
 */
function createFakeDb(tables: Tables, failures: Record<string, TableError> = {}) {
  const query = (table: string) => {
    const rows = () => (tables[table] ??= []);
    const filters: Array<(row: Row) => boolean> = [];
    let write: ((matching: Row[]) => void) | null = null;
    const matching = () =>
      rows().filter((row) => filters.every((filter) => filter(row)));

    const settle = () => {
      if (!write) return { data: matching(), error: null, count: matching().length };
      const error = failures[table] ?? null;
      if (!error) write(matching());
      return { data: null, error };
    };

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      update: (patch: Row) => {
        write = (found) => found.forEach((row) => Object.assign(row, patch));
        return builder;
      },
      delete: () => {
        write = (found) => {
          tables[table] = rows().filter((row) => !found.includes(row));
        };
        return builder;
      },
      insert: (row: Row) => {
        rows().push(row);
        return builder;
      },
      upsert: async (row: Row) => {
        rows().push(row);
        return { error: null };
      },
      maybeSingle: () => {
        const result = { data: matching()[0] ?? null, error: null };
        return {
          overrideTypes: async () => result,
          then: (resolve: (value: typeof result) => unknown) => resolve(result),
        };
      },
      then: (resolve: (value: ReturnType<typeof settle>) => unknown) =>
        resolve(settle()),
    };

    return builder;
  };

  return { from: jest.fn(query) };
}

function seedTables(requestStatus: string | null): Tables {
  return {
    events: [
      {
        event_id: EVENT_ID,
        event_name: "Approval Event",
        require_participant_approval: true,
        participant_capacity: null,
        paid: false,
      },
    ],
    user_event_roles: [
      { event_id: EVENT_ID, user_id: ORGANIZER_ID, role: "organizer" },
      { event_id: EVENT_ID, user_id: TARGET_ID, role: "participant" },
    ],
    participant_approval_requests: requestStatus
      ? [
          {
            id: "request-1",
            event_id: EVENT_ID,
            user_id: TARGET_ID,
            requested_role: "participant",
            status: requestStatus,
            reviewed_by: "first-reviewer",
            reviewed_at: "2026-01-01T00:00:00.000Z",
          },
        ]
      : [],
  };
}

function mockClients(tables: Tables, failures?: Record<string, TableError>) {
  const db = createFakeDb(tables, failures);
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    ...db,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: ORGANIZER_ID } },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(db);
  return db;
}

async function removeParticipant() {
  const response = await DELETE(
    { json: async () => ({ notify: false }) } as never,
    { params: Promise.resolve({ eventId: EVENT_ID, userId: TARGET_ID }) },
  );
  if (!response) throw new Error("DELETE returned no response");
  return response;
}

function targetRole(tables: Tables) {
  return tables.user_event_roles.find((row) => row.user_id === TARGET_ID);
}

describe("DELETE /api/events/[eventId]/participants/[userId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revokes the approval and records who reviewed it", async () => {
    const tables = seedTables("approved");
    mockClients(tables);

    const response = await removeParticipant();

    expect(response.status).toBe(200);
    expect(targetRole(tables)).toBeUndefined();
    const [request] = tables.participant_approval_requests;
    expect(request.status).toBe("rejected");
    expect(request.reviewed_by).toBe(ORGANIZER_ID);
    expect(request.reviewed_at).not.toBe("2026-01-01T00:00:00.000Z");
    expect(request.rejection_reason).toBeTruthy();
  });

  it("does not let a removed participant rejoin without a new decision", async () => {
    const tables = seedTables("approved");
    const db = mockClients(tables);

    await removeParticipant();
    const result = await joinParticipantEvent(
      db as unknown as ServiceSupabaseClient,
      { eventId: EVENT_ID, userId: TARGET_ID, channel: "web" },
    );

    expect(result).toMatchObject({ status: "error", httpStatus: 403 });
    expect(targetRole(tables)).toBeUndefined();
  });

  it("keeps the participant in the event when the revocation fails", async () => {
    const tables = seedTables("approved");
    mockClients(tables, {
      participant_approval_requests: { message: "write failed" },
    });

    const response = await removeParticipant();

    expect(response.status).toBe(500);
    expect(targetRole(tables)).toBeDefined();
    expect(tables.participant_approval_requests[0].status).toBe("approved");
  });

  it.each(["pending", "rejected", "withdrawn"])(
    "leaves a %s request untouched",
    async (status) => {
      const tables = seedTables(status);
      mockClients(tables);

      const response = await removeParticipant();

      expect(response.status).toBe(200);
      expect(tables.participant_approval_requests[0]).toMatchObject({
        status,
        reviewed_by: "first-reviewer",
      });
    },
  );

  it("removes a participant who has no approval request", async () => {
    const tables = seedTables(null);
    mockClients(tables);

    const response = await removeParticipant();

    expect(response.status).toBe(200);
    expect(targetRole(tables)).toBeUndefined();
    expect(tables.participant_approval_requests).toEqual([]);
  });
});
