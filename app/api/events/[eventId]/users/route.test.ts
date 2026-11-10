/** @jest-environment node */
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

function setup(rows: number) {
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user: { id: "org" },
    rpcResults: { is_admin_user: { data: false } },
    tables: { user_event_roles: queryMock({ data: { role: "organizer" }, error: null }) },
  }));
  const data = Array.from({ length: rows }, (_, i) => ({ user_id: `u${i}`, role: "participant", user_profiles: { uid: `u${i}`, email: "", display_name: "", affiliation: "" } }));
  const roles = queryMock({ data, error: null, count: 1234 });
  const teams = queryMock({ data: [], error: null });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({ tables: { user_event_roles: roles, team_members: teams } }));
  return { roles, teams };
}

const get = (qs: string) =>
  GET(new NextRequest(`http://localhost/api/events/evt/users?${qs}`), { params: Promise.resolve({ eventId: "evt" }) });

describe("GET /api/events/[eventId]/users paging contract (ORG-024)", () => {
  it("applies offset/limit with a stable order and returns the count", async () => {
    const { roles } = setup(500);
    const res = await get("roles=participant&limit=500&offset=1000&includeCount=true");
    expect(res.status).toBe(200);
    expect(roles.range).toHaveBeenCalledWith(1000, 1499);
    expect(roles.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(roles.order).toHaveBeenCalledWith("user_id", { ascending: true });
    expect((await res.json()).count).toBe(1234);
  });

  it("clamps oversized and garbage paging params", async () => {
    const { roles } = setup(0);
    await get("roles=participant&limit=99999&offset=abc");
    expect(roles.range).toHaveBeenCalledWith(0, 499);
    const second = setup(0);
    await get("roles=participant&limit=-5&offset=-10");
    expect(second.roles.range).toHaveBeenCalledWith(0, 0);
  });

  it("looks up teams only for the page's users, in chunks", async () => {
    const { teams } = setup(250);
    await get("roles=participant&limit=500");
    expect(teams.in).toHaveBeenCalledTimes(3);
    expect(teams.in.mock.calls[0][1]).toHaveLength(100);
  });

  it("skips the team lookup for an empty page", async () => {
    const { teams } = setup(0);
    await get("roles=participant");
    expect(teams.in).not.toHaveBeenCalled();
  });
});
