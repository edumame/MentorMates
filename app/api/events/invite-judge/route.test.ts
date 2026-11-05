/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { NEW_INVITEE_NEEDS_PUBLISHED_EVENT_ERROR } from "@/lib/events/invite-emails";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole, EventVisibility } from "@/lib/types";
import { POST } from "./route";

const mockResendSend = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;
const mockCanAccessRole = canAccessRole as jest.Mock;

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
    emails: {
      send: mockResendSend,
    },
  })),
}));

function mockNewInviteeEvent(visibility: EventVisibility | null) {
  const upsert = jest.fn().mockResolvedValue({ error: null });

  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer-1" } },
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { role: EventRole.Organizer },
          }),
          upsert,
        };
      }

      if (table === "events") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { event_name: "Hack Night", slug: "hack-night", visibility },
          }),
        };
      }

      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { display_name: "Casey Organizer" },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: jest.fn(),
  });

  mockCreateSupabaseServiceClient.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    })),
  });

  return { upsert };
}

function inviteNewJudge() {
  return POST(
    new Request("http://localhost/api/events/invite-judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "event-123", email: "new@email.com" }),
    })
  );
}

describe("POST /api/events/invite-judge", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://mentormates.ai",
      RESEND_API_KEY: "resend-key",
    };
    mockCanAccessRole.mockReturnValue(true);
    mockResendSend.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("adds an existing user as judge and sends the invite email even for draft events", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });

    mockCreateSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "organizer-1" } },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest
              .fn()
              .mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: EventRole.Organizer },
            }),
            upsert,
          };
        }

        if (table === "events") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                event_name: "Hack Night",
                slug: "hack-night",
                visibility: EventVisibility.Draft,
              },
            }),
          };
        }

        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                display_name: "Casey Organizer",
                email: "casey@mentormates.ai",
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: jest.fn(),
    });

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { uid: "judge-user-1" },
        }),
      })),
    });

    const response = await POST(
      new Request("http://localhost/api/events/invite-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-123",
          email: "Judge@Email.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      userExists: true,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-123",
        role: EventRole.Judge,
        user_id: "judge-user-1",
      }),
      { onConflict: "user_id,event_id" }
    );
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "judge@email.com",
        subject: expect.stringContaining("judge"),
        html: expect.stringContaining("/events/hack-night/accept-judge"),
      })
    );
  });

  it.each([
    EventVisibility.Draft,
    EventVisibility.Archived,
    EventVisibility.Test,
    EventVisibility.Demo,
    null,
  ])(
    "does not email a dead accept link to someone with no account when visibility is %s",
    async (visibility) => {
      const { upsert } = mockNewInviteeEvent(visibility);

      const response = await inviteNewJudge();

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: NEW_INVITEE_NEEDS_PUBLISHED_EVENT_ERROR,
      });
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    }
  );

  it("explains the draft block rather than reporting email as unconfigured", async () => {
    delete process.env.RESEND_API_KEY;
    mockNewInviteeEvent(EventVisibility.Draft);

    const response = await inviteNewJudge();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: NEW_INVITEE_NEEDS_PUBLISHED_EVENT_ERROR,
    });
  });

  it.each([EventVisibility.Public, EventVisibility.Private])(
    "emails the accept link to someone with no account on a %s event",
    async (visibility) => {
      mockNewInviteeEvent(visibility);

      const response = await inviteNewJudge();

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        success: true,
        userExists: false,
      });
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          to: "new@email.com",
          html: expect.stringContaining("/events/hack-night/accept-judge"),
        })
      );
    }
  );

  it("returns 503 for new users when email sending is not configured", async () => {
    delete process.env.RESEND_API_KEY;

    mockCreateSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "organizer-1" } },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: EventRole.Organizer },
            }),
          };
        }

        if (table === "events") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                event_name: "Hack Night",
                slug: "hack-night",
                visibility: EventVisibility.Private,
              },
            }),
          };
        }

        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                display_name: "Casey Organizer",
                email: "casey@mentormates.ai",
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: jest.fn(),
    });

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
        }),
      })),
    });

    const response = await POST(
      new Request("http://localhost/api/events/invite-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-123",
          email: "judge@email.com",
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Email is not configured (RESEND_API_KEY missing)",
    });
  });
});
