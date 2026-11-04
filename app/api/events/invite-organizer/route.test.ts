/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole, EventVisibility } from "@/lib/types";
import { POST } from "./route";

const mockResendSend = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}));

function mockEvent({
  visibility,
  invitee,
}: {
  visibility: EventVisibility | null;
  invitee: { uid: string } | null;
}) {
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
      maybeSingle: jest.fn().mockResolvedValue({ data: invitee }),
    })),
  });

  return { upsert };
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
      RESEND_API_KEY: "resend-key",
    };
    mockResendSend.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each([EventVisibility.Draft, EventVisibility.Archived, null])(
    "does not email a dead accept link to someone with no account when visibility is %s",
    async (visibility) => {
      mockEvent({ visibility, invitee: null });

      const response = await invite();

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: expect.stringContaining("Publish the event"),
      });
      expect(mockResendSend).not.toHaveBeenCalled();
    }
  );

  it.each([EventVisibility.Public, EventVisibility.Private])(
    "emails the accept link to someone with no account on a %s event",
    async (visibility) => {
      mockEvent({ visibility, invitee: null });

      const response = await invite();

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        success: true,
        userExists: false,
      });
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend.mock.calls[0][0].html).toContain(
        "https://mentormates.ai/events/hack-night/accept-organizer?email=new%40email.com"
      );
    }
  );

  it("still adds an existing user to a draft, since their role lets them open it", async () => {
    const { upsert } = mockEvent({
      visibility: EventVisibility.Draft,
      invitee: { uid: "user-2" },
    });

    const response = await invite();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      userExists: true,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });
});
