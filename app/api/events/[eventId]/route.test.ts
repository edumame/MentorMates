/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DELETE } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

const eventId = "11111111-1111-4111-8111-111111111111";
const userId = "44444444-4444-4444-8444-444444444444";

type Db = {
  eventExists: boolean;
  callerRole: string | null;
  tracks: number;
  deletedTables: string[];
};

/**
 * Cookie-scoped client that behaves like RLS for a co-organizer: the events
 * delete only matches while the caller still has an organizer role row, and
 * matching no rows is not an error.
 */
function makeUserClient(db: Db, isAdmin = false) {
  const from = (table: string) => {
    let isDelete = false;
    const query: Record<string, unknown> = {
      select: () => query,
      eq: () => query,
      in: () => query,
      delete: () => {
        isDelete = true;
        return query;
      },
      maybeSingle: async () => {
        if (table === "user_event_roles") {
          return { data: db.callerRole ? { role: db.callerRole } : null, error: null };
        }
        return { data: db.eventExists ? { event_id: eventId } : null, error: null };
      },
      then: (resolve: (value: unknown) => void) => {
        if (isDelete) {
          db.deletedTables.push(table);
          if (table === "user_event_roles") db.callerRole = null;
          if (table === "event_tracks") db.tracks = 0;
          if (table === "events" && db.callerRole) db.eventExists = false;
          resolve({ data: null, error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return query;
  };

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: isAdmin, error: null }),
    from: jest.fn(from),
  };
}

/** Service client whose RPC is all-or-nothing, like the database transaction. */
function makeServiceClient(db: Db, failure?: { message: string }) {
  return {
    rpc: jest.fn(async () => {
      if (failure) return { data: null, error: failure };
      const existed = db.eventExists;
      db.eventExists = false;
      db.tracks = 0;
      db.callerRole = null;
      return { data: existed, error: null };
    }),
  };
}

function setup({
  callerRole = "organizer",
  isAdmin = false,
  failure,
}: {
  callerRole?: string | null;
  isAdmin?: boolean;
  failure?: { message: string };
} = {}) {
  const db: Db = { eventExists: true, callerRole, tracks: 2, deletedTables: [] };
  const userClient = makeUserClient(db, isAdmin);
  const serviceClient = makeServiceClient(db, failure);
  mockCreateSupabaseClient.mockResolvedValue(userClient);
  mockCreateServiceClient.mockReturnValue(serviceClient);
  return { db, userClient, serviceClient };
}

function callDelete() {
  return DELETE(
    new NextRequest(`http://localhost/api/events/${eventId}`, { method: "DELETE" }),
    { params: Promise.resolve({ eventId }) }
  );
}

describe("DELETE /api/events/[eventId]", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("removes the event when a co-organizer deletes it", async () => {
    const { db, serviceClient } = setup();

    const res = await callDelete();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(db.eventExists).toBe(false);
    expect(serviceClient.rpc).toHaveBeenCalledWith("delete_event_and_related", {
      p_event_id: eventId,
    });
  });

  it("never deletes through the caller's RLS-scoped client", async () => {
    const { db } = setup();

    await callDelete();

    expect(db.deletedTables).toEqual([]);
  });

  it("removes the event for a global admin with no role on it", async () => {
    const { db } = setup({ callerRole: null, isAdmin: true });

    const res = await callDelete();

    expect(res.status).toBe(200);
    expect(db.eventExists).toBe(false);
  });

  it("reports failure and leaves the data intact when the delete fails", async () => {
    const { db } = setup({ failure: { message: "constraint detail" } });

    const res = await callDelete();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to delete event" });
    expect(db.eventExists).toBe(true);
    expect(db.tracks).toBe(2);
    expect(db.callerRole).toBe("organizer");
  });

  it("does not report success when no event row was deleted", async () => {
    const { serviceClient } = setup();
    serviceClient.rpc.mockResolvedValue({ data: false, error: null });

    const res = await callDelete();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Event not found" });
  });

  it("forbids a user who is neither organizer nor admin", async () => {
    const { db, serviceClient } = setup({ callerRole: "participant" });

    const res = await callDelete();

    expect(res.status).toBe(403);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
    expect(db.eventExists).toBe(true);
  });

  it("returns 404 before touching anything when the event is missing", async () => {
    const { db, serviceClient } = setup();
    db.eventExists = false;

    const res = await callDelete();

    expect(res.status).toBe(404);
    expect(serviceClient.rpc).not.toHaveBeenCalled();
  });
});
