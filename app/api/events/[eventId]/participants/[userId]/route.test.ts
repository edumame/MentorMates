/** @jest-environment node */
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendUserEventEmail } from "@/lib/email/send-user-event-email";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { EventRole } from "@/lib/types";
import { DELETE, GET, PATCH } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/email/send-user-event-email", () => ({ sendUserEventEmail: jest.fn() }));

const ctx = { params: Promise.resolve({ eventId: "evt", userId: "target" }) };
type Handler = (r: NextRequest, c: typeof ctx) => Promise<Response | undefined>;
async function run(handler: Handler, request: NextRequest, context: typeof ctx): Promise<Response> {
  const response = await handler(request, context);
  if (!response) throw new Error("handler returned no response");
  return response;
}

function setup({
  callerRole = EventRole.Organizer as EventRole | null,
  targetRole = EventRole.Participant as EventRole | null,
  isAdmin = false,
  write = { data: [{ user_id: "target" }], error: null } as { data: unknown; error: unknown },
  scoreCount = 0,
  removal = {
    data: { removedTeamMemberships: 1, promotedTeamLeads: 1, closedApprovalRequests: 1 },
    error: null,
  } as { data: unknown; error: unknown },
} = {}) {
  const writeQuery = queryMock(write);
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user: { id: "caller" },
    rpcResults: { is_admin_user: { data: isAdmin } },
    tables: {
      user_event_roles: [
        queryMock({ data: callerRole ? { role: callerRole } : null, error: null }),
        queryMock({ data: targetRole ? { user_id: "target", role: targetRole } : null, error: null }),
        writeQuery,
      ],
    },
  }));
  const scores = queryMock({ data: null, error: null, count: scoreCount });
  const service = supabaseMock({
    tables: { project_scores: scores },
    rpcResults: { remove_event_member: removal },
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(service);
  (sendUserEventEmail as jest.Mock).mockResolvedValue({ ok: true });
  return { writeQuery, service };
}

const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/events/evt/participants/target", {
    method, body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("participants/[userId] route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("refuses to promote someone to organizer unless admin (ORG-012/ORG-002)", async () => {
    const { writeQuery } = setup();
    const res = await run(PATCH, req("PATCH", { role: EventRole.Organizer }), ctx);
    expect(res.status).toBe(403);
    expect(writeQuery.update).not.toHaveBeenCalled();
  });

  it("refuses to change another organizer's role (ORG-002)", async () => {
    setup({ targetRole: EventRole.Organizer });
    expect((await run(PATCH, req("PATCH", { role: EventRole.Mentor }), ctx)).status).toBe(403);
  });

  it("returns 403 when RLS filtered the update to zero rows", async () => {
    setup({ write: { data: [], error: null } });
    expect((await run(PATCH, req("PATCH", { role: EventRole.Mentor }), ctx)).status).toBe(403);
  });

  it("maps the last-organizer guard to 409 (EVT-ORG-001)", async () => {
    setup({ isAdmin: true, targetRole: EventRole.Organizer, write: { data: null, error: { code: "P0001", hint: "last_organizer" } } });
    expect((await run(PATCH, req("PATCH", { role: EventRole.Participant }), ctx)).status).toBe(409);
  });

  it("notifies via the shared helper, not an unauthenticated HTTP call (PUB-005)", async () => {
    setup();
    const fetchSpy = jest.spyOn(global, "fetch");
    const res = await run(PATCH, req("PATCH", { role: EventRole.Mentor, notify: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ notified: true }));
    expect(sendUserEventEmail).toHaveBeenCalledWith(expect.objectContaining({ eventId: "evt", userId: "target", emailType: "event_role_changed", membershipAlreadyVerified: false }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reports notified:false when the email could not be sent", async () => {
    setup();
    (sendUserEventEmail as jest.Mock).mockResolvedValue({ ok: false, status: 503, error: "x" });
    const res = await run(PATCH, req("PATCH", { role: EventRole.Mentor, notify: true }), ctx);
    expect(await res.json()).toEqual(expect.objectContaining({ notified: false }));
  });

  it("removes the member and cleans up in one RPC, then sends the removal notice (ORG-008/PUB-005)", async () => {
    const { service } = setup();
    const res = await run(DELETE, req("DELETE", { notify: true }), ctx);
    expect(res.status).toBe(200);
    expect(service.rpc).toHaveBeenCalledWith("remove_event_member", {
      p_event_id: "evt", p_user_id: "target", p_actor_id: "caller",
    });
    expect(await res.json()).toEqual(expect.objectContaining({
      removedTeamMemberships: 1, promotedTeamLeads: 1, closedApprovalRequests: 1, notified: true,
    }));
    expect(sendUserEventEmail).toHaveBeenCalledWith(expect.objectContaining({
      emailType: "event_member_removed", membershipAlreadyVerified: true,
    }));
  });

  it("returns 404 when the member was already gone", async () => {
    setup({ removal: { data: null, error: null } });
    expect((await run(DELETE, req("DELETE"), ctx)).status).toBe(404);
    expect(sendUserEventEmail).not.toHaveBeenCalled();
  });

  it("maps the last-organizer guard on removal to 409", async () => {
    setup({ isAdmin: true, targetRole: EventRole.Organizer, removal: { data: null, error: { code: "P0001", hint: "last_organizer" } } });
    expect((await run(DELETE, req("DELETE"), ctx)).status).toBe(409);
  });

  it("forbids non-organizers", async () => {
    setup({ callerRole: EventRole.Participant });
    expect((await run(DELETE, req("DELETE"), ctx)).status).toBe(403);
  });

  it("returns the judge's score count before removal (JUDGE-017)", async () => {
    setup({ targetRole: EventRole.Judge, scoreCount: 7 });
    const res = await run(GET, req("GET"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user_id: "target", role: EventRole.Judge, judgeScoreCount: 7 });
  });

  it("returns 0 scores for non-judges without querying scores", async () => {
    const { service } = setup();
    const res = await run(GET, req("GET"), ctx);
    expect((await res.json()).judgeScoreCount).toBe(0);
    expect((service.from as jest.Mock).mock.calls.map((c) => c[0])).not.toContain("project_scores");
  });
});

