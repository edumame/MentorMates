/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

const mockResendSend = jest.fn();

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/features/user/roles/roles", () => ({
  canAccessRole: jest.fn(),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: result }),
    maybeSingle: jest.fn().mockResolvedValue({ data: result }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  };
}

function mockInvitee(invitee: { uid: string } | null) {
  const tables: Record<string, unknown> = {
    user_event_roles: { role: EventRole.Organizer },
    events: { event_name: "Hack Night", slug: "old-slug" },
    user_profiles: { display_name: "Casey", email: "casey@mentormates.ai" },
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer-1" } },
      }),
    },
    from: jest.fn((table: string) => chain(tables[table])),
    rpc: jest.fn(),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => chain(invitee)),
  });
}

function invite() {
  return POST(
    new Request("http://localhost/api/events/invite-organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "event-123", email: "new@email.com" }),
    })
  );
}

describe("POST /api/events/invite-organizer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://mentormates.ai",
      RESEND_API_KEY: "test-resend-key",
    };
    (canAccessRole as jest.Mock).mockReturnValue(true);
    mockResendSend.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("links new organizers to the event id so a slug rename cannot break it", async () => {
    mockInvitee(null);

    const response = await invite();

    expect(response.status).toBe(200);
    const { html } = mockResendSend.mock.calls[0][0];
    expect(html).toContain("/events/event-123/accept-organizer");
    expect(html).not.toContain("old-slug");
  });

  it("links existing organizers to the event id", async () => {
    mockInvitee({ uid: "user-2" });

    const response = await invite();

    expect(response.status).toBe(200);
    const { html } = mockResendSend.mock.calls[0][0];
    expect(html).toContain("/events/event-123/overview");
    expect(html).not.toContain("old-slug");
  });
});
