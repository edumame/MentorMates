/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { GET, POST, DELETE } from "./route";

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const EVENT_ID = "11111111-1111-1111-1111-111111111111";

type Ops = Array<[string, unknown[]]>;

// Chainable Supabase query-builder mock. `getResult(ops)` is invoked when the
// chain is awaited or terminated with single()/maybeSingle(); `ops` records the
// builder methods that were called so the handler can branch on select/insert/etc.
function chain(getResult: (ops: Ops) => unknown) {
  const ops: Ops = [];
  const push =
    (name: string) =>
    (...args: unknown[]) => {
      ops.push([name, args]);
      return builder;
    };
  const resolve = () => Promise.resolve(getResult(ops));
  const builder: Record<string, unknown> = {
    select: push("select"),
    insert: push("insert"),
    update: push("update"),
    delete: push("delete"),
    eq: push("eq"),
    in: push("in"),
    order: push("order"),
    single: () => resolve(),
    maybeSingle: () => resolve(),
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      resolve().then(onOk, onErr),
  };
  return builder;
}

function opType(ops: Ops): string {
  return ops[0]?.[0] ?? "";
}

// Regular (auth) client: getUser + user_event_roles role lookup.
function mockAuthClient(userId: string | null, role: EventRole | null) {
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : new Error("no user"),
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") {
        return chain(() => ({ data: role ? { role } : null, error: null }));
      }
      throw new Error(`Unexpected auth-client table ${table}`);
    }),
  });
}

function params() {
  return { params: Promise.resolve({ eventId: EVENT_ID }) };
}

describe("teams API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns 403 when the caller has no role on the event", async () => {
    mockAuthClient("user-1", null);
    mockCreateSupabaseServiceClient.mockReturnValue({ from: jest.fn() });

    const res = await GET(
      new Request(`http://localhost/api/events/${EVENT_ID}/teams`),
      params()
    );

    expect(res.status).toBe(403);
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockAuthClient(null, null);
    mockCreateSupabaseServiceClient.mockReturnValue({ from: jest.fn() });

    const res = await POST(
      new Request(`http://localhost/api/events/${EVENT_ID}/teams`, {
        method: "POST",
        body: JSON.stringify({ name: "Team Rocket" }),
      }),
      params()
    );

    expect(res.status).toBe(401);
  });

  it("POST rejects a participant who is already on a team (409)", async () => {
    mockAuthClient("p1", EventRole.Participant);
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "team_members") {
          // findUsersAlreadyOnTeam → caller already present.
          return chain(() => ({ data: [{ user_id: "p1" }], error: null }));
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await POST(
      new Request(`http://localhost/api/events/${EVENT_ID}/teams`, {
        method: "POST",
        body: JSON.stringify({ name: "Dupes" }),
      }),
      params()
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "You are already on a team for this event",
    });
  });

  it("POST creates a team and seeds the caller as lead", async () => {
    mockAuthClient("p1", EventRole.Participant);

    let teamMembersSelectCalls = 0;
    const memberInsert = jest.fn(() => ({ error: null }));

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "team_members") {
          return chain((ops) => {
            if (opType(ops) === "insert") {
              return memberInsert();
            }
            // First select = "already on team?" (none). Second = hydrate members.
            teamMembersSelectCalls += 1;
            if (teamMembersSelectCalls === 1) return { data: [], error: null };
            return {
              data: [
                {
                  id: "m1",
                  team_id: "t1",
                  user_id: "p1",
                  event_id: EVENT_ID,
                  role: "lead",
                  joined_at: "2026-01-01T00:00:00Z",
                },
              ],
              error: null,
            };
          });
        }
        if (table === "teams") {
          return chain(() => ({
            data: {
              id: "t1",
              event_id: EVENT_ID,
              name: "Avengers",
              created_by: "p1",
              project_id: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          }));
        }
        if (table === "user_profiles") {
          return chain(() => ({
            data: [
              {
                uid: "p1",
                display_name: "Pat",
                email: "pat@example.com",
                avatar_url: null,
              },
            ],
            error: null,
          }));
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await POST(
      new Request(`http://localhost/api/events/${EVENT_ID}/teams`, {
        method: "POST",
        body: JSON.stringify({ name: "Avengers" }),
      }),
      params()
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.team.name).toBe("Avengers");
    expect(body.team.members).toHaveLength(1);
    expect(body.team.members[0]).toMatchObject({
      user_id: "p1",
      role: "lead",
      display_name: "Pat",
    });
    expect(memberInsert).toHaveBeenCalledTimes(1);
  });

  it("POST lets an organizer create a team without joining it as lead", async () => {
    mockAuthClient("org1", EventRole.Organizer);

    const memberA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const memberB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    let teamMembersSelectCalls = 0;
    let insertedMembers: Array<{ user_id: string; role: string }> = [];

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          // filterEventMembers — both selected users are on the event.
          return chain(() => ({
            data: [{ user_id: memberA }, { user_id: memberB }],
            error: null,
          }));
        }
        if (table === "team_members") {
          return chain((ops) => {
            if (opType(ops) === "insert") {
              insertedMembers = ops[0][1][0] as Array<{
                user_id: string;
                role: string;
              }>;
              return { error: null };
            }
            // First select = "already on team?" (none). Second = hydrate.
            teamMembersSelectCalls += 1;
            if (teamMembersSelectCalls === 1) return { data: [], error: null };
            return {
              data: [
                {
                  id: "m1",
                  team_id: "t1",
                  user_id: "p1",
                  event_id: EVENT_ID,
                  role: "lead",
                  joined_at: "2026-01-01T00:00:00Z",
                },
              ],
              error: null,
            };
          });
        }
        if (table === "teams") {
          return chain(() => ({
            data: {
              id: "t1",
              event_id: EVENT_ID,
              name: "Org Team",
              created_by: "p1",
              project_id: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          }));
        }
        if (table === "user_profiles") {
          return chain(() => ({ data: [], error: null }));
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await POST(
      new Request(`http://localhost/api/events/${EVENT_ID}/teams`, {
        method: "POST",
        body: JSON.stringify({
          name: "Org Team",
          memberUserIds: [memberA, memberB],
        }),
      }),
      params()
    );

    expect(res.status).toBe(201);
    // Organizer (org1) is not among the inserted members; first selected is lead.
    expect(insertedMembers.map((m) => m.user_id)).not.toContain("org1");
    expect(insertedMembers[0].role).toBe("lead");
    expect(insertedMembers).toHaveLength(2);
  });

  it("DELETE lets a member leave their own team", async () => {
    mockAuthClient("p2", EventRole.Participant);

    const memberDelete = jest.fn(() => ({ error: null }));
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "teams") {
          return chain(() => ({
            data: { id: "t1", event_id: EVENT_ID, created_by: "p1" },
            error: null,
          }));
        }
        if (table === "team_members") {
          return chain(() => memberDelete());
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await DELETE(
      {
        nextUrl: {
          searchParams: new URLSearchParams({ teamId: "t1", userId: "p2" }),
        },
      } as unknown as Parameters<typeof DELETE>[0],
      params()
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(memberDelete).toHaveBeenCalledTimes(1);
  });

  it("DELETE lets an organizer dissolve any team", async () => {
    mockAuthClient("org1", EventRole.Organizer);

    const teamDelete = jest.fn(() => ({ error: null }));
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "teams") {
          return chain((ops) => {
            if (opType(ops) === "delete") return teamDelete();
            return {
              data: { id: "t1", event_id: EVENT_ID, created_by: "p1" },
              error: null,
            };
          });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const res = await DELETE(
      {
        nextUrl: { searchParams: new URLSearchParams({ teamId: "t1" }) },
      } as unknown as Parameters<typeof DELETE>[0],
      params()
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      dissolved: true,
    });
    expect(teamDelete).toHaveBeenCalledTimes(1);
  });
});
