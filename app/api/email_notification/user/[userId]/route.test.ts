/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockSend } })),
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("POST /api/email_notification/user/[userId] check-in tickets", () => {
  const originalSecret = process.env.CHECKIN_QR_SECRET;
  const originalResendKey = process.env.RESEND_API_KEY;
  let POST: typeof import("./route").POST;

  const sendTicket = () =>
    POST(
      new NextRequest("http://localhost/api/email_notification/user/x", {
        method: "POST",
        body: JSON.stringify({
          eventId: EVENT_ID,
          eventName: "Hack",
          emailType: EMAIL_TYPES.CHECKIN_QR_CODE,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    );

  beforeAll(async () => {
    // The route builds its Resend client when the module loads.
    process.env.RESEND_API_KEY = "re_test";
    ({ POST } = await import("./route"));
  });

  afterAll(() => {
    process.env.CHECKIN_QR_SECRET = originalSecret;
    process.env.RESEND_API_KEY = originalResendKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHECKIN_QR_SECRET = "test-checkin-secret";
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "staff" } },
          error: null,
        }),
      },
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { email: "attendee@example.com" },
          error: null,
        }),
      })),
    });
  });

  it("sends the signed ticket link to the attendee's own address", async () => {
    const response = await sendTicket();

    expect(response.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "attendee@example.com",
        html: expect.stringMatching(/&sig=[0-9a-f]{64}"/),
      })
    );
  });

  it("returns a JSON error and sends nothing when tickets cannot be signed", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    delete process.env.CHECKIN_QR_SECRET;

    const response = await sendTicket();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to build email",
    });
    expect(mockSend).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
