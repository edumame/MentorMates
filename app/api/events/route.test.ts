/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventVisibility } from "@/lib/types";
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

function mockSupabase(visibility: EventVisibility) {
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "owner-1", email: "owner@email.com" } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "events") {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              event_id: "event-123",
              event_name: "Hack Night",
              slug: "hack-night",
              visibility,
            },
            error: null,
          }),
        };
      }

      if (table === "user_event_roles") {
        return { upsert: jest.fn().mockResolvedValue({ error: null }) };
      }

      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { display_name: "Casey Organizer" },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  });

  mockCreateSupabaseServiceClient.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ uid: "user-2", email: "existing@email.com" }],
        error: null,
      }),
    })),
  });
}

function createEvent(visibility: EventVisibility) {
  return POST(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          event_name: "Hack Night",
          event_date: "2026-12-01",
          location: "Online",
          visibility,
        },
        organizerEmails: ["existing@email.com", "new@email.com"],
      }),
    })
  );
}

describe("POST /api/events organizer invites", () => {
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

  it("does not send an accept link for a draft, and reports who was skipped", async () => {
    mockSupabase(EventVisibility.Draft);

    const response = await createEvent(EventVisibility.Draft);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.organizerInviteSummary).toEqual({
      sent: 1,
      failed: [],
      deferred: ["new@email.com"],
    });
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe("existing@email.com");
  });

  it("sends the accept link when the event is created published", async () => {
    mockSupabase(EventVisibility.Public);

    const response = await createEvent(EventVisibility.Public);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.organizerInviteSummary).toEqual({
      sent: 2,
      failed: [],
      deferred: [],
    });
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@email.com",
        html: expect.stringContaining("/accept-organizer?email=new%40email.com"),
      })
    );
  });
});
