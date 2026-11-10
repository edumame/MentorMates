/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { GET as GET_TICKET } from "./ticket/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateEventCheckinToken, generateEventRoleInviteToken } from "@/lib/utils/jwt";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ATTENDEE = "22222222-2222-4222-8222-222222222222";

function query(result: { data: unknown; error?: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn(async () => ({ error: null, ...result }));
  return q;
}

function setup({
  user = { id: "org-1" } as { id: string } | null,
  isOrganizer = false,
  isAdmin = false,
  attendeeRole = { role: "participant" } as { role: string } | null,
  ownRole = { role: "participant" } as { role: string } | null,
  checkin = { data: [{ outcome: "checked_in", recorded_at: "2026-11-09T10:00:00Z" }], error: null } as {
    data: unknown;
    error: unknown;
  },
} = {}) {
  const rpc = jest.fn(async (name: string) => ({
    data: name === "is_admin_user" ? isAdmin : isOrganizer,
    error: null,
  }));
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    rpc,
    from: () => query({ data: ownRole }),
  } as never);
  const serviceRpc = jest.fn(async () => checkin);
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    from: (table: string) =>
      query({ data: table === "user_event_roles" ? attendeeRole : { display_name: "Ada" } }),
    rpc: serviceRpc,
  } as never);
  return { rpc, serviceRpc };
}

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/checkin", { method: "POST", body: JSON.stringify(body) }));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-checkin-tokens";
});

describe("POST /api/checkin (PUB-007)", () => {
  it("rejects the old unauthenticated GET query-string check-in", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("requires a signed-in user", async () => {
    setup({ user: null });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    expect((await post({ token })).status).toBe(401);
  });

  it.each([
    ["missing", {}],
    ["raw evt/usr string", { token: `evt=${EVENT_ID}&usr=${ATTENDEE}` }],
  ])("rejects a %s token", async (_label, body) => {
    setup({ isOrganizer: true });
    expect((await post(body)).status).toBe(400);
  });

  it("rejects a validly signed token of another purpose", async () => {
    setup({ isOrganizer: true });
    const token = await generateEventRoleInviteToken({ email: "a@example.test", eventId: EVENT_ID, role: "organizer" });
    expect((await post({ token })).status).toBe(400);
  });

  it("forbids non-organizers without revealing registration", async () => {
    const { rpc } = setup({ isOrganizer: false, isAdmin: false });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    const res = await post({ token });
    expect(res.status).toBe(403);
    expect(rpc).toHaveBeenCalledWith("is_event_organizer_or_owner", { p_event_id: EVENT_ID, p_user_id: "org-1" });
  });

  it("records the check-in for an organizer", async () => {
    const { serviceRpc } = setup({ isOrganizer: true });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    const res = await post({ token });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      verified: true,
      recorded: true,
      timestamp: "2026-11-09T10:00:00Z",
      attendee: { name: "Ada", role: "participant" },
    });
    expect(serviceRpc).toHaveBeenCalledWith("record_event_checkin", {
      p_event_id: EVENT_ID,
      p_user_id: ATTENDEE,
      p_checked_in_by: "org-1",
    });
  });

  it("records the check-in for a platform admin", async () => {
    const { serviceRpc } = setup({ isAdmin: true });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    expect((await post({ token })).status).toBe(200);
    expect(serviceRpc).toHaveBeenCalledWith("record_event_checkin", expect.objectContaining({ p_checked_in_by: "org-1" }));
  });

  it("returns 409 with the first scan time on a repeat scan", async () => {
    setup({
      isOrganizer: true,
      checkin: { data: [{ outcome: "already_checked_in", recorded_at: "2026-11-09T09:00:00Z" }], error: null },
    });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    const res = await post({ token });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Already checked in",
      alreadyCheckedIn: true,
      timestamp: "2026-11-09T09:00:00Z",
    });
  });

  it("returns 404 if the registration disappears before the record is written", async () => {
    setup({ isOrganizer: true, checkin: { data: [{ outcome: "not_registered", recorded_at: null }], error: null } });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    expect((await post({ token })).status).toBe(404);
  });

  it.each([
    ["an RPC error", { data: null, error: { message: "boom" } }],
    ["no outcome row", { data: [], error: null }],
  ])("returns 500 and never claims success on %s", async (_label, checkin) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    setup({ isOrganizer: true, checkin });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    const res = await post({ token });
    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("recorded", true);
  });

  it("does not record anything for a non-organizer", async () => {
    const { serviceRpc } = setup({ isOrganizer: false, isAdmin: false });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    expect((await post({ token })).status).toBe(403);
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it("reports when the ticket holder is no longer registered", async () => {
    setup({ isAdmin: true, attendeeRole: null });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    expect((await post({ token })).status).toBe(404);
  });
});

describe("GET /api/checkin/ticket", () => {
  const get = (eventId: string) => GET_TICKET(new Request(`http://localhost/api/checkin/ticket?eventId=${eventId}`));

  it("requires a valid event id", async () => {
    setup();
    expect((await get("not-a-uuid")).status).toBe(400);
  });

  it("requires sign-in", async () => {
    setup({ user: null });
    expect((await get(EVENT_ID)).status).toBe(401);
  });

  it("refuses users who are not registered for the event", async () => {
    setup({ user: { id: ATTENDEE }, ownRole: null });
    expect((await get(EVENT_ID)).status).toBe(403);
  });

  it("issues a token for the signed-in user only, accepted by check-in", async () => {
    setup({ user: { id: ATTENDEE } });
    const res = await get(EVENT_ID);
    expect(res.status).toBe(200);
    const { token } = await res.json();

    setup({ isOrganizer: true });
    const checkin = await post({ token });
    expect(checkin.status).toBe(200);
  });
});
