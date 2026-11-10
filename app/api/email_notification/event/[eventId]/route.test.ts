/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
const mockSend = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));

const call = (body: unknown) =>
  POST(new Request("http://localhost/api/email_notification/event/e1", {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
  }), { params: Promise.resolve({ eventId: "e1" }) });

describe("POST /api/email_notification/event/[eventId] status codes (PUB-015)", () => {
  beforeEach(() => (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({})));

  it("returns 401 without a session", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({ user: null }));
    expect((await call({ emailType: "event_update" })).status).toBe(401);
  });

  it("returns 403 (not 500) for a signed-in user with no role in the event", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
      user: { id: "u1" },
      tables: { user_event_roles: queryMock({ data: null, error: null }) },
    }));
    expect((await call({ emailType: "event_update" })).status).toBe(403);
  });

  it("returns 403 for a participant", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
      user: { id: "u1" },
      tables: { user_event_roles: queryMock({ data: { role: "participant" }, error: null }) },
    }));
    expect((await call({ emailType: "event_update" })).status).toBe(403);
  });

  it("returns 400 for a malformed body", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({ user: { id: "u1" } }));
    expect((await call("not json")).status).toBe(400);
  });

  function organizerOf(event: Record<string, unknown>) {
    (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
      user: { id: "u1" },
      tables: {
        user_event_roles: queryMock({ data: { role: "organizer" }, error: null }),
        events: queryMock({ data: { event_id: "e1", event_name: "Ev", ...event }, error: null }),
      },
    }));
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(supabaseMock({
      tables: { user_event_roles: queryMock({ data: [{ user_id: "m1", user_profiles: { email: "m1@example.test" } }], error: null }) },
    }));
  }

  it("refuses event-wide email for events that are not approved yet", async () => {
    process.env.RESEND_API_KEY = "test";
    organizerOf({ approval_status: "not_submitted" });
    const res = await call({ emailType: "custom_update", emailContent: '<a href="https://phish.example.test">x</a>' });
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends custom_update text escaped, never raw organizer HTML", async () => {
    process.env.RESEND_API_KEY = "test";
    mockSend.mockResolvedValue({ data: {}, error: null });
    organizerOf({ approval_status: "approved" });
    const res = await call({ emailType: "custom_update", emailContent: '<a href="https://phish.example.test">x</a>' });
    expect(res.status).toBe(200);
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).not.toContain('<a href="https://phish.example.test"');
    expect(html).toContain("&lt;a href=");
  });
});
