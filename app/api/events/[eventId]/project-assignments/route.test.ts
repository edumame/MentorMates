/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { EventRole } from "@/lib/types";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const ctx = { params: Promise.resolve({ eventId: "evt" }) };
const request = new Request("http://localhost/api/events/evt/project-assignments");

function setup({
  callerRole = EventRole.Organizer as EventRole | null,
  isAdmin = false,
  projects = { data: [{ id: "p1" }], error: null } as { data: unknown; error: unknown },
  assignments = { data: [], error: null } as { data: unknown; error: unknown },
} = {}) {
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user: { id: "caller" },
    rpcResults: { is_admin_user: { data: isAdmin } },
    tables: {
      user_event_roles: queryMock({ data: callerRole ? { role: callerRole } : null, error: null }),
    },
  }));
  const assignmentQuery = queryMock(assignments);
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({
    tables: { projects: queryMock(projects), project_assignments: assignmentQuery },
  }));
  return { assignmentQuery };
}

describe("GET /api/events/[eventId]/project-assignments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only returns active assignments, so revoked judges and mentors are hidden", async () => {
    const { assignmentQuery } = setup({
      assignments: {
        data: [{
          id: "a1", project_id: "p1", user_id: "m1", role: "mentor",
          projects: { id: "p1", project_name: "Proj", lead_name: "Lead" },
          user_profiles: { display_name: "Mentor", email: "m@example.com" },
        }],
        error: null,
      },
    });
    const response = await GET(request, ctx);
    expect(response.status).toBe(200);
    expect(assignmentQuery.in).toHaveBeenCalledWith("project_id", ["p1"]);
    expect(assignmentQuery.is).toHaveBeenCalledWith("revoked_at", null);
    const body = await response.json();
    expect(body.assignments).toHaveLength(1);
    expect(body.assignments[0]).toMatchObject({ role: "mentor", user: { display_name: "Mentor" } });
  });

  it("rejects callers who are not organizers or admins", async () => {
    const { assignmentQuery } = setup({ callerRole: EventRole.Mentor });
    const response = await GET(request, ctx);
    expect(response.status).toBe(403);
    expect(assignmentQuery.select).not.toHaveBeenCalled();
  });

  it("returns an empty list without querying assignments when the event has no projects", async () => {
    const { assignmentQuery } = setup({ projects: { data: [], error: null } });
    const response = await GET(request, ctx);
    expect(await response.json()).toEqual({ assignments: [] });
    expect(assignmentQuery.select).not.toHaveBeenCalled();
  });

  it("returns 500 when the assignment query fails", async () => {
    setup({ assignments: { data: null, error: { message: "boom" } } });
    const response = await GET(request, ctx);
    expect(response.status).toBe(500);
  });
});
