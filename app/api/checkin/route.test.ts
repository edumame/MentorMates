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
  jest.mocked(createSupabaseServiceClient).mockReturnValue({
    from: (table: string) =>
      query({ data: table === "user_event_roles" ? attendeeRole : { display_name: "Ada" } }),
  } as never);
  return { rpc };
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

  it("verifies a registered attendee for an organizer and says nothing was recorded", async () => {
    setup({ isOrganizer: true });
    const token = await generateEventCheckinToken({ eventId: EVENT_ID, userId: ATTENDEE });
    const res = await post({ token });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      verified: true,
      recorded: false,
      attendee: { name: "Ada", role: "participant" },
    });
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
