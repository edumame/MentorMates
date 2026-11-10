/** @jest-environment node */
import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));

const EVENT = "11111111-1111-4111-8111-111111111111";

function setup(result: { data?: unknown; error?: { code?: string; message?: string } | null }, user: unknown = { id: "org" }) {
  const rpc = jest.fn().mockResolvedValue({ data: null, error: null, ...result });
  const from = jest.fn();
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: "x" } }) },
    rpc,
    from,
  });
  return { rpc, from };
}

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/roles/assign", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/roles/assign (JUDGE-008)", () => {
  it("rejects invalid input before touching the database", async () => {
    const { rpc } = setup({});
    expect((await post({ eventId: EVENT, role: "judge", rolesPerProject: 0 })).status).toBe(400);
    expect((await post({ eventId: EVENT, role: "organizer", rolesPerProject: 1 })).status).toBe(400);
    expect((await post({ eventId: "not-a-uuid", role: "judge", rolesPerProject: 1 })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    setup({}, null);
    expect((await post({ eventId: EVENT, role: "judge", rolesPerProject: 1 })).status).toBe(401);
  });

  it("runs the whole reassignment in the auto_assign_event_roles RPC", async () => {
    const { rpc, from } = setup({ data: { assigned: 4, projects: 2, skipped: false } });
    const res = await post({ eventId: EVENT, role: "judge", rolesPerProject: 2, includeOrganizers: true });
    expect(res.status).toBe(200);
    expect((await res.json()).assignedCount).toBe(4);
    expect(rpc).toHaveBeenCalledWith("auto_assign_event_roles", {
      p_event_id: EVENT,
      p_role: "judge",
      p_per_project: 2,
      p_include_organizers: true,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("defaults includeOrganizers to false", async () => {
    const { rpc } = setup({ data: { assigned: 1, projects: 1, skipped: false } });
    await post({ eventId: EVENT, role: "mentor", rolesPerProject: 1 });
    expect(rpc).toHaveBeenCalledWith("auto_assign_event_roles", expect.objectContaining({ p_include_organizers: false }));
  });

  it("reports a no-op when there are no submitted projects", async () => {
    setup({ data: { assigned: 0, projects: 0, skipped: true } });
    const body = await (await post({ eventId: EVENT, role: "judge", rolesPerProject: 1 })).json();
    expect(body).toEqual(expect.objectContaining({ success: true, skipped: true, assignedCount: 0 }));
  });

  it("maps errors: forbidden, pool too small, unexpected", async () => {
    setup({ error: { code: "42501", message: "forbidden" } });
    expect((await post({ eventId: EVENT, role: "judge", rolesPerProject: 1 })).status).toBe(403);

    setup({ error: { code: "P0001", message: "not_enough_roles:1" } });
    const tooFew = await post({ eventId: EVENT, role: "judge", rolesPerProject: 3 });
    expect(tooFew.status).toBe(400);
    expect((await tooFew.json()).error).toMatch(/Only 1 judge available/);

    setup({ error: { code: "XX000", message: "boom" } });
    const failed = await post({ eventId: EVENT, role: "judge", rolesPerProject: 1 });
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toMatch(/Existing assignments were kept/);
  });
});
