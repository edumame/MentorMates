/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EMAIL_TYPES } from "@/lib/email_templates/constants";
import { EventRole } from "@/lib/types";

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
    emails: { send: mockResendSend },
  })),
}));

const EVENT_ID = "event-1";
const ORGANIZER = "organizer-1";
const PARTICIPANT = "participant-1";
const VICTIM = "victim-1";
const OUTSIDER = "outsider-1";
const ADMIN = "admin-1";
const INJECTED_NAME = "</h1><a href=https://evil>Verify your account</a>";

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {
  user_event_roles: [
    { event_id: EVENT_ID, user_id: ORGANIZER, role: EventRole.Organizer },
    { event_id: EVENT_ID, user_id: PARTICIPANT, role: EventRole.Participant },
    { event_id: EVENT_ID, user_id: VICTIM, role: EventRole.Participant },
  ],
  user_profiles: [
    { uid: PARTICIPANT, email: "participant@example.com" },
    { uid: VICTIM, email: "victim@example.com" },
    { uid: OUTSIDER, email: "outsider@example.com" },
  ],
  events: [{ event_id: EVENT_ID, event_name: "Real & Good Hack", slug: "real" }],
};

// Answers queries from `tables`, honouring every .eq() filter, so a route that
// forgets to scope a lookup to the event or the user gets the wrong answer.
function fakeFrom(table: string) {
  const filters: Array<[string, unknown]> = [];
  const find = () =>
    (tables[table] ?? []).find((row) =>
      filters.every(([column, value]) => row[column] === value)
    ) ?? null;
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(function (this: unknown, column: string, value: unknown) {
      filters.push([column, value]);
      return this;
    }),
    maybeSingle: jest.fn(async () => ({ data: find(), error: null })),
    single: jest.fn(async () => {
      const data = find();
      return { data, error: data ? null : { message: "no rows" } };
    }),
  };
  return query;
}

function signInAs(userId: string | null) {
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : { message: "Auth session missing" },
      }),
    },
    from: jest.fn(fakeFrom),
    rpc: jest.fn(async (_name: string, args: { user_id: string }) => ({
      data: args.user_id === ADMIN,
      error: null,
    })),
  });
}

function send(targetUserId: string, body: Record<string, unknown>) {
  // Loaded here because the route builds its Resend client at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST } = require("./route");
  return POST(
    new NextRequest(
      `http://localhost/api/email_notification/user/${targetUserId}`,
      { method: "POST", body: JSON.stringify(body) }
    ),
    { params: Promise.resolve({ userId: targetUserId }) }
  );
}

describe("POST /api/email_notification/user/[userId]", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://mentormates.ai",
      RESEND_API_KEY: "resend-key",
    };
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: jest.fn(fakeFrom),
    });
    mockResendSend.mockResolvedValue({ data: { id: "email" }, error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const checkin = { eventId: EVENT_ID, emailType: EMAIL_TYPES.CHECKIN_QR_CODE };

  it("returns 401 without a session", async () => {
    signInAs(null);

    const response = await send(VICTIM, checkin);

    expect(response.status).toBe(401);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects a caller with no role using a made-up event and injected name", async () => {
    signInAs(OUTSIDER);

    const response = await send(VICTIM, {
      eventId: "x",
      emailType: EMAIL_TYPES.CHECKIN_QR_CODE,
      eventName: INJECTED_NAME,
    });

    expect(response.status).toBe(403);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects a participant emailing another member of the same event", async () => {
    signInAs(PARTICIPANT);

    const response = await send(VICTIM, checkin);

    expect(response.status).toBe(403);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects an organizer emailing someone outside the event", async () => {
    signInAs(ORGANIZER);

    const response = await send(OUTSIDER, checkin);

    expect(response.status).toBe(404);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects an admin when the event does not exist", async () => {
    tables.user_event_roles.push({
      event_id: "gone",
      user_id: VICTIM,
      role: EventRole.Participant,
    });
    signInAs(ADMIN);

    const response = await send(VICTIM, { ...checkin, eventId: "gone" });
    tables.user_event_roles.pop();

    expect(response.status).toBe(404);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("lets an organizer send a check-in email to an event member", async () => {
    signInAs(ORGANIZER);

    const response = await send(VICTIM, checkin);

    expect(response.status).toBe(200);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe("victim@example.com");
  });

  it.each([EMAIL_TYPES.CHECKIN_QR_CODE, EMAIL_TYPES.EVENT_UPDATE])(
    "uses the database event name and ignores the body for %s",
    async (emailType) => {
      signInAs(ORGANIZER);

      const response = await send(VICTIM, {
        eventId: EVENT_ID,
        emailType,
        eventName: INJECTED_NAME,
      });

      expect(response.status).toBe(200);
      const { subject, html } = mockResendSend.mock.calls[0][0];
      expect(subject).toContain("Real & Good Hack");
      expect(subject).not.toContain("evil");
      expect(html).toContain("Real &amp; Good Hack");
      expect(html).not.toContain("evil");
    }
  );

  it("lets a site admin who has no role in the event send", async () => {
    signInAs(ADMIN);

    const response = await send(VICTIM, checkin);

    expect(response.status).toBe(200);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("lets an event member send to themselves", async () => {
    signInAs(PARTICIPANT);

    const response = await send(PARTICIPANT, checkin);

    expect(response.status).toBe(200);
    expect(mockResendSend.mock.calls[0][0].to).toBe("participant@example.com");
  });

  it("rejects a non-member sending to themselves", async () => {
    signInAs(OUTSIDER);

    const response = await send(OUTSIDER, checkin);

    expect(response.status).toBe(404);
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
