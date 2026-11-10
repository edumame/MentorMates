/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyEventRoleInviteToken } from "@/lib/utils/jwt";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

const mockSend = jest.fn();
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
// Invitations are stored rows since lane B round 2; keep these route tests DB-free.
jest.mock("@/lib/events/role-invitations", () => ({
  issueEventRoleInviteToken: (payload: { email: string; eventId: string; role: "participant" | "judge" | "organizer" }) =>
    jest.requireActual("@/lib/utils/jwt").generateEventRoleInviteToken({ ...payload, jti: "test-invite" }),
}));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));

const eventId = "12345678-1234-4234-8234-123456789abc";
const upsert = jest.fn();
const quotaRpc = jest.fn();
function setup(existing: boolean) {
  const query = (data: unknown) => ({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data }),
    maybeSingle: jest.fn().mockResolvedValue({ data }), upsert,
  });
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "sender" } } }) },
    from: jest.fn((table) => {
      if (table === "user_event_roles") return query({ role: EventRole.Organizer });
      if (table === "events") return query({ event_name: "Draft Event", slug: "old-slug" });
      if (table === "user_profiles") return query({ display_name: "Casey" });
      throw new Error(`Unexpected table ${table}`);
    }),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => query(existing ? { uid: "recipient" } : null)),
    rpc: quotaRpc,
  });
}
function invite() {
  return POST(new Request("http://localhost/api/events/invite-organizer", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, email: " Invitee@Example.com " }),
  }));
}

describe("organizer invitation email entry", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: "https://mentormates.ai/", RESEND_API_KEY: "test", JWT_SECRET: "test-secret-long-enough-for-signed-invites" };
    mockSend.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
    quotaRpc.mockResolvedValue({ data: [{ allowed: true, retry_at: null, scope: null }], error: null });
  });
  afterAll(() => { process.env = originalEnv; });

  it.each([true, false])("sends a signed stable-ID acceptance link when existing user=%s", async (existing) => {
    setup(existing);
    const response = await invite();
    expect(response.status).toBe(200);
    // ORG-012: the response never discloses whether the address has an account.
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = mockSend.mock.calls[0][0];
    expect(message.to).toBe("invitee@example.com");
    const link = message.html.match(/href="([^"]+)"/)[1];
    const url = new URL(link);
    expect(url.pathname).toBe(`/events/${eventId}/accept-organizer`);
    expect(url.searchParams.get("email")).toBe("invitee@example.com");
    await expect(verifyEventRoleInviteToken(url.searchParams.get("token")!)).resolves.toEqual({ email: "invitee@example.com", eventId, role: "organizer", jti: "test-invite" });
    // ORG-012 / MENT-008: the role is granted only when the invite is accepted.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not grant the organizer role to an existing account and reports unavailable mail", async () => {
    setup(true);
    delete process.env.RESEND_API_KEY;
    const response = await invite();
    expect(response.status).toBe(503);
    expect(upsert).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("reports failed delivery for an existing account without granting access", async () => {
    setup(true);
    mockSend.mockResolvedValue({ error: { message: "mail unavailable" } });
    expect((await invite()).status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects callers who are not organizers of the event", async () => {
    setup(false);
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "sender" } } }) },
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: table === "user_event_roles" ? { role: EventRole.Participant } : null }),
      })),
      rpc: jest.fn().mockResolvedValue({ data: false }),
    });
    expect((await invite()).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("reports unavailable mail for a new invitee", async () => {
    setup(false);
    delete process.env.RESEND_API_KEY;
    expect((await invite()).status).toBe(503);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("reports failed delivery for a new invitee", async () => {
    setup(false);
    mockSend.mockRejectedValue(new Error("mail unavailable"));
    expect((await invite()).status).toBe(500);
  });

  it("returns 429 without sending once the daily invite quota is used up (ORG-012)", async () => {
    setup(false);
    quotaRpc.mockResolvedValue({ data: [{ allowed: false, retry_at: new Date(Date.now() + 3600_000).toISOString(), scope: "inviter" }], error: null });
    const response = await invite();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(mockSend).not.toHaveBeenCalled();
    expect(quotaRpc).toHaveBeenCalledWith("consume_invite_quota", { p_inviter_id: "sender", p_event_id: eventId });
  });
});
