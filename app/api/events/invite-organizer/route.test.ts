/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyEventRoleInviteToken } from "@/lib/utils/jwt";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

const mockSend = jest.fn();
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));

const eventId = "12345678-1234-4234-8234-123456789abc";
const upsert = jest.fn();
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
  });
  afterAll(() => { process.env = originalEnv; });

  it.each([true, false])("sends a signed stable-ID acceptance link when existing user=%s", async (existing) => {
    setup(existing);
    const response = await invite();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, userExists: existing });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = mockSend.mock.calls[0][0];
    expect(message.to).toBe("invitee@example.com");
    const link = message.html.match(/href="([^"]+)"/)[1];
    const url = new URL(link);
    expect(url.pathname).toBe(`/events/${eventId}/accept-organizer`);
    expect(url.searchParams.get("email")).toBe("invitee@example.com");
    await expect(verifyEventRoleInviteToken(url.searchParams.get("token")!)).resolves.toEqual({ email: "invitee@example.com", eventId, role: "organizer" });
    if (existing) {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "recipient", event_id: eventId, role: EventRole.Organizer }), { onConflict: "user_id,event_id" });
    } else {
      expect(upsert).not.toHaveBeenCalled();
    }
  });

  it("does not send an invitation when the existing user's role write fails", async () => {
    setup(true);
    upsert.mockResolvedValue({ error: { message: "write failed" } });
    expect((await invite()).status).toBe(500);
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
});
