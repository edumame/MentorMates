/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

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

type Row = Record<string, unknown>;

const EVENT_ID = "event-1";
const CALLER_ID = "organizer-1";

const roleRows = (role: EventRole, ...userIds: string[]): Row[] =>
  userIds.map((user_id) => ({ user_id, role, event_id: EVENT_ID }));

/**
 * Minimal in-memory Supabase: filters are really applied to the seeded rows, so
 * a test observes which users the route's pool query actually selects.
 */
function mockSupabase(tables: Record<string, Row[]>) {
  const upserts: Row[] = [];
  const deletes: Array<Array<[string, unknown]>> = [];

  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const eqFilters: Array<[string, unknown]> = [];
    let isDelete = false;

    const run = () => {
      if (isDelete) {
        deletes.push(eqFilters);
        return { data: null, error: null };
      }
      const rows = tables[table] ?? [];
      return {
        data: rows.filter((row) => filters.every((filter) => filter(row))),
        error: null,
      };
    };

    const builder = {
      select: () => builder,
      delete: () => {
        isDelete = true;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        eqFilters.push([column, value]);
        filters.push((row) => row[column] === value);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      upsert: async (row: Row) => {
        upserts.push(row);
        return { error: null };
      },
      maybeSingle: async () => {
        const { data } = run();
        return { data: data?.[0] ?? null, error: null };
      },
      then: (resolve: (value: ReturnType<typeof run>) => unknown) =>
        Promise.resolve(run()).then(resolve),
    };

    return builder;
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: CALLER_ID } },
        error: null,
      }),
    },
    from,
  });

  return { upserts, deletes };
}

const assign = (body: Row) =>
  POST(
    new Request("https://mentormates.ai/api/roles/assign", {
      method: "POST",
      body: JSON.stringify({ eventId: EVENT_ID, ...body }),
    })
  );

const assignedUserIds = (upserts: Row[]) =>
  new Set(upserts.map((row) => row.user_id));

describe("POST /api/roles/assign", () => {
  const projects = [
    { id: "project-1", event_id: EVENT_ID, submitted: true },
    { id: "project-2", event_id: EVENT_ID, submitted: true },
  ];
  const organizers = roleRows(EventRole.Organizer, CALLER_ID, "org-2", "org-3");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts organizers toward the pool when includeOrganizers is set", async () => {
    const { upserts } = mockSupabase({
      projects,
      project_assignments: [],
      user_event_roles: [
        ...roleRows(EventRole.Judge, "judge-1", "judge-2"),
        ...organizers,
      ],
    });

    const response = await assign({
      role: EventRole.Judge,
      rolesPerProject: 3,
      includeOrganizers: true,
    });

    expect(response.status).toBe(200);
    expect(upserts).toHaveLength(6);
    // 2 projects x 3 seats walk all 5 pool members, so everyone is placed.
    expect(assignedUserIds(upserts)).toEqual(
      new Set(["judge-1", "judge-2", CALLER_ID, "org-2", "org-3"])
    );
  });

  it("stores organizers under the requested role, for judges and mentors", async () => {
    for (const role of [EventRole.Judge, EventRole.Mentor]) {
      const { upserts } = mockSupabase({
        projects,
        project_assignments: [],
        user_event_roles: organizers,
      });

      const response = await assign({
        role,
        rolesPerProject: 2,
        includeOrganizers: true,
      });

      expect(response.status).toBe(200);
      expect(upserts).toHaveLength(4);
      expect(upserts.every((row) => row.role === role)).toBe(true);
    }
  });

  it("does not pull in other roles when includeOrganizers is set", async () => {
    const { upserts } = mockSupabase({
      projects,
      project_assignments: [],
      user_event_roles: [
        ...roleRows(EventRole.Judge, "judge-1"),
        ...roleRows(EventRole.Mentor, "mentor-1"),
        ...roleRows(EventRole.Participant, "participant-1"),
        ...roleRows(EventRole.Organizer, CALLER_ID),
      ],
    });

    const response = await assign({
      role: EventRole.Judge,
      rolesPerProject: 2,
      includeOrganizers: true,
    });

    expect(response.status).toBe(200);
    expect(assignedUserIds(upserts)).toEqual(new Set(["judge-1", CALLER_ID]));
  });

  it("still rejects when judges and organizers together are too few", async () => {
    const { upserts, deletes } = mockSupabase({
      projects,
      project_assignments: [{ id: "a-1", event_id: EVENT_ID, role: "judge" }],
      user_event_roles: [
        ...roleRows(EventRole.Judge, "judge-1"),
        ...roleRows(EventRole.Organizer, CALLER_ID),
      ],
    });

    const response = await assign({
      role: EventRole.Judge,
      rolesPerProject: 3,
      includeOrganizers: true,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Not enough roles to assign",
    });
    expect(upserts).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });

  it.each([
    ["false", false],
    ["omitted", undefined],
  ])("keeps organizers out when includeOrganizers is %s", async (_, flag) => {
    const { upserts } = mockSupabase({
      projects,
      project_assignments: [],
      user_event_roles: [
        ...roleRows(EventRole.Judge, "judge-1", "judge-2"),
        ...organizers,
      ],
    });

    const success = await assign({
      role: EventRole.Judge,
      rolesPerProject: 2,
      includeOrganizers: flag,
    });
    expect(success.status).toBe(200);
    expect(assignedUserIds(upserts)).toEqual(new Set(["judge-1", "judge-2"]));

    const tooFew = await assign({
      role: EventRole.Judge,
      rolesPerProject: 3,
      includeOrganizers: flag,
    });
    expect(tooFew.status).toBe(400);
  });
});
