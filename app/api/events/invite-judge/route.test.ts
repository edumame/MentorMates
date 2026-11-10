/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole, EventVisibility } from "@/lib/types";
import { POST } from "./route";

const mockResendSend = jest.fn();
const quotaRpc = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;
const mockCanAccessRole = canAccessRole as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

// Invitations are stored rows since lane B round 2; keep these route tests DB-free.
jest.mock("@/lib/events/role-invitations", () => ({
  issueEventRoleInviteToken: (payload: { email: string; eventId: string; role: "participant" | "judge" | "organizer" }) =>
    jest.requireActual("@/lib/utils/jwt").generateEventRoleInviteToken({ ...payload, jti: "test-invite" }),
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

describe("POST /api/events/invite-judge", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://mentormates.ai",
      RESEND_API_KEY: "resend-key",
      JWT_SECRET: "test-secret-with-enough-length-for-hs256",
    };
    mockCanAccessRole.mockReturnValue(true);
    mockResendSend.mockResolvedValue({ error: null });
    quotaRpc.mockResolvedValue({ data: [{ allowed: true, retry_at: null, scope: null }], error: null });
    mockCreateSupabaseServiceClient.mockReturnValue({ rpc: quotaRpc });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sends an acceptance link (never a direct judge grant) even for draft events", async () => {
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
      rpc: quotaRpc,
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
    // ORG-012 / MENT-008: uniform response and no role write; the judge role
    // is granted only when the invitee accepts while signed in with the email.
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(upsert).not.toHaveBeenCalled();
    expect(quotaRpc).toHaveBeenCalledWith("consume_invite_quota", {
      p_inviter_id: "organizer-1",
      p_event_id: "event-123",
    });
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "judge@email.com",
        subject: expect.stringContaining("judge"),
        // The link uses the immutable event id, not the editable slug.
        html: expect.stringMatching(
          /\/events\/event-123\/accept-judge\?email=[^"&]+&token=[\w.-]+/
        ),
      })
    );
  });

  it("returns 503 when email sending is not configured", async () => {
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
      rpc: quotaRpc,
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

  it("returns 500 without granting access when delivery fails", async () => {
    const upsert = jest.fn();
    mockResendSend.mockResolvedValue({ error: { name: "send_failed" } });
    mockCreateSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "organizer-1" } } }) },
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        upsert,
        maybeSingle: jest.fn().mockResolvedValue({ data: { role: EventRole.Organizer } }),
        single: jest.fn().mockResolvedValue({
          data: table === "events"
            ? { event_name: "Hack Night", slug: "hack-night", visibility: EventVisibility.Private }
            : { display_name: "Casey Organizer" },
        }),
      })),
      rpc: jest.fn(),
    });
    const response = await POST(
      new Request("http://localhost/api/events/invite-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: "event-123", email: "judge@email.com" }),
      })
    );
    expect(response.status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();
  });
});
