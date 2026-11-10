/** @jest-environment node */
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { POST } from "./route";

const mockSend = jest.fn();
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));

const EVENT = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const SENDER = "33333333-3333-4333-8333-333333333333";

function setup({ organizer = false, member = true, sender = SENDER as string | null } = {}) {
  (createSupabaseClient as jest.Mock).mockResolvedValue(
    supabaseMock({
      user: sender ? { id: sender } : null,
      rpcResults: {
        is_event_organizer_or_owner: { data: organizer },
        is_admin_user: { data: false },
      },
    })
  );
  const service = supabaseMock({
    tables: {
      user_event_roles: queryMock({ data: member ? { user_id: TARGET } : null, error: null }),
      events: queryMock({ data: { event_id: EVENT, event_name: "<b>Real Event</b>", slug: "real" }, error: null }),
      user_profiles: queryMock({ data: { email: "target@example.test" }, error: null }),
    },
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(service);
  return service;
}

const send = (body: Record<string, unknown>, userId = TARGET) =>
  POST(
    new NextRequest(`http://localhost/api/email_notification/user/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ userId }) }
  );

describe("POST /api/email_notification/user/[userId] (ORG-019 / PUB-004 / PUB-015)", () => {
  const env = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, RESEND_API_KEY: "test", NEXT_PUBLIC_APP_URL: "https://mentormates.ai" };
    mockSend.mockResolvedValue({ data: { id: "m1" }, error: null });
  });
  afterAll(() => { process.env = env; });

  it("returns 401 without a session", async () => {
    setup({ sender: null });
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("forbids non-organizers from emailing another user", async () => {
    setup({ organizer: false });
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects unknown email types instead of defaulting to check-in", async () => {
    setup({ organizer: true });
    expect((await send({ eventId: EVENT, emailType: "anything" })).status).toBe(400);
  });

  it("rejects malformed ids", async () => {
    setup({ organizer: true });
    expect((await send({ eventId: "not-a-uuid", emailType: "event_update" })).status).toBe(400);
  });

  it("refuses recipients who are not members of the event", async () => {
    setup({ organizer: true, member: false });
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses the DB event name (escaped) and ignores a client-supplied eventName", async () => {
    setup({ organizer: true });
    const res = await send({
      eventId: EVENT,
      emailType: "event_update",
      eventName: '<a href="https://phish.example.test">Claim</a>',
    });
    expect(res.status).toBe(200);
    const message = mockSend.mock.calls[0][0];
    expect(message.to).toBe("target@example.test");
    expect(message.html).not.toContain("phish.example.test");
    expect(message.html).toContain("&lt;b&gt;Real Event&lt;/b&gt;");
  });

  it("lets a member request their own check-in email", async () => {
    setup({ organizer: false, sender: TARGET });
    expect((await send({ eventId: EVENT, emailType: "checkin_qr_code" })).status).toBe(200);
  });

  it("does not let a member send other email types to themself", async () => {
    setup({ organizer: false, sender: TARGET });
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(403);
  });

  it("reports 503 when email is not configured", async () => {
    setup({ organizer: true });
    delete process.env.RESEND_API_KEY;
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(503);
  });

  it("reports provider failures as 502", async () => {
    setup({ organizer: true });
    mockSend.mockResolvedValue({ data: null, error: { name: "validation_error" } });
    expect((await send({ eventId: EVENT, emailType: "event_update" })).status).toBe(502);
  });
});
