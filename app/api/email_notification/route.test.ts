/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

const mockBatchSend = jest.fn();

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    batch: { send: (...args: unknown[]) => mockBatchSend(...args) },
  })),
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TICKET_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "user-1";

const member = (i: number) => `member${i}@email.com`;

type Ticket = {
  id: string;
  event_id: string;
  purchased_by_user_id: string;
  assigned_to_email: string | null;
} | null;

/** Every message handed to Resend, flattened across batches. */
const sentMessages = () =>
  mockBatchSend.mock.calls.flatMap(
    ([batch]) => batch as { from: string; to: string; subject: string; html: string }[]
  );

describe("POST /api/email_notification", () => {
  const body = {
    requestId: REQUEST_ID,
    eventId: EVENT_ID,
    to: "admin@mentormates.ai",
    subject: "Schedule update",
    html: "<p>Hello</p>",
    bcc: [member(1), member(2)],
  };

  const send = (payload: unknown = body) =>
    POST({ json: async () => payload } as never);

  /**
   * The route no longer reads the caller's event role directly; it asks the
   * is_event_organizer_or_owner / is_admin_user RPCs. Map roles onto those.
   */
  const signIn = ({
    user = { id: USER_ID } as { id: string } | null,
    role = EventRole.Organizer as EventRole | null,
    isAdmin = false,
  } = {}) => {
    const rpc = jest.fn(async (name: string) => {
      if (name === "is_event_organizer_or_owner") {
        return { data: role === EventRole.Organizer, error: null };
      }
      if (name === "is_admin_user") return { data: isAdmin, error: null };
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    });
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      rpc,
    });
    return rpc;
  };

  /** Service client: event membership lookup plus ticket/event reads. */
  const service = ({
    members = body.bcc as string[],
    ticket = null as Ticket,
  } = {}) => {
    const inFilter = jest.fn((_column: string, emails: string[]) =>
      Promise.resolve({
        data: emails
          .filter((email) => members.includes(email))
          .map((email) => ({ user_profiles: { email } })),
        error: null,
      })
    );
    const from = jest.fn((table: string) => {
      if (table === "user_event_roles") {
        return { select: () => ({ eq: () => ({ in: inFilter }) }) };
      }
      if (table === "event_tickets") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: ticket, error: null }),
            }),
          }),
        };
      }
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              single: jest
                .fn()
                .mockResolvedValue({ data: { event_name: "Hack Night" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from });
    return { inFilter, from };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchSend.mockResolvedValue({ data: {}, error: null });
    signIn();
    service();
  });

  it("rejects anonymous callers", async () => {
    signIn({ user: null });

    expect((await send()).status).toBe(401);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it.each([
    ["a participant", EventRole.Participant],
    ["a mentor", EventRole.Mentor],
    ["a judge", EventRole.Judge],
    ["a non-member", null],
  ])("rejects %s", async (_label, role) => {
    signIn({ role });

    expect((await send()).status).toBe(403);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("allows platform admins who aren't in the event", async () => {
    signIn({ role: null, isAdmin: true });

    expect((await send()).status).toBe(200);
    expect(mockBatchSend).toHaveBeenCalledTimes(1);
  });

  it("asks the permission RPCs about the requested event and caller", async () => {
    const rpc = signIn();

    await send();

    expect(rpc).toHaveBeenCalledWith("is_event_organizer_or_owner", {
      p_event_id: EVENT_ID,
      p_user_id: USER_ID,
    });
    expect(rpc).toHaveBeenCalledWith("is_admin_user", { user_id: USER_ID });
  });

  it("fails closed when the permission lookup errors", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true, error: { message: "boom" } }),
    });

    expect((await send()).status).toBe(500);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it.each([
    ["no requestId", { ...body, requestId: undefined }],
    ["a non-uuid requestId", { ...body, requestId: "req-1" }],
    ["a non-uuid eventId", { ...body, eventId: "event-1" }],
    ["no event or ticket", { ...body, eventId: undefined }],
    ["no to address", { ...body, to: undefined }],
    ["an invalid recipient", { ...body, bcc: ["not-an-email"] }],
    ["no subject", { ...body, subject: "" }],
    ["no html", { ...body, html: "" }],
    ["a non-object body", null],
  ])("rejects a request with %s", async (_label, payload) => {
    expect((await send(payload)).status).toBe(400);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("refuses the whole send if any recipient is outside the event", async () => {
    const response = await send({
      ...body,
      bcc: [member(1), "stranger@email.com"],
    });

    expect(response.status).toBe(403);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("refuses a cc recipient outside the event", async () => {
    const response = await send({ ...body, cc: ["victim@email.com"] });

    expect(response.status).toBe(403);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("checks the to address against the event when there is no bcc/cc", async () => {
    const response = await send({ ...body, bcc: [], to: "stranger@email.com" });

    expect(response.status).toBe(403);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("ignores a sender supplied by the client and sends one message per recipient", async () => {
    await send({ ...body, from: "ceo@mentormates.ai" });

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const messages = sentMessages();
    expect(messages.map((m) => m.from)).toEqual([
      NOTIFICATIONS_EMAIL_FROM,
      NOTIFICATIONS_EMAIL_FROM,
    ]);
    expect(messages.map((m) => m.to)).toEqual(body.bcc);
    for (const message of messages) {
      expect(message).not.toHaveProperty("cc");
      expect(message).not.toHaveProperty("bcc");
      expect(message.subject).toBe(body.subject);
      expect(message.html).toBe(body.html);
    }
  });

  it("removes duplicate recipients, case-insensitively, across bcc and cc", async () => {
    await send({
      ...body,
      bcc: [member(1), member(1), "MEMBER1@email.com"],
      cc: [member(1)],
    });

    expect(sentMessages().map((m) => m.to)).toEqual([member(1)]);
  });

  it("batches large sends in chunks of 100 with stable idempotency keys", async () => {
    const bcc = Array.from({ length: 150 }, (_, i) => member(i));
    const { inFilter } = service({ members: bcc });

    const response = await send({ ...body, bcc });

    expect(response.status).toBe(200);
    expect(inFilter).toHaveBeenCalledTimes(1);
    expect(mockBatchSend.mock.calls.map(([batch]) => batch.length)).toEqual([100, 50]);
    const keys = mockBatchSend.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(keys.every((key) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
    expect(new Set(keys).size).toBe(2);

    // A retry with the same requestId reuses the same keys.
    mockBatchSend.mockClear();
    await send({ ...body, bcc });
    expect(mockBatchSend.mock.calls.map(([, options]) => options.idempotencyKey)).toEqual(keys);
  });

  it("uses different idempotency keys for a different requestId", async () => {
    await send();
    const [first] = mockBatchSend.mock.calls.map(([, o]) => o.idempotencyKey);
    mockBatchSend.mockClear();

    await send({ ...body, requestId: "44444444-4444-4444-8444-444444444444" });
    const [second] = mockBatchSend.mock.calls.map(([, o]) => o.idempotencyKey);

    expect(second).not.toBe(first);
  });

  it("refuses more than 500 recipients", async () => {
    const bcc = Array.from({ length: 300 }, (_, i) => member(i));
    const cc = Array.from({ length: 300 }, (_, i) => member(i + 300));

    const response = await send({ ...body, bcc, cc });

    expect(response.status).toBe(400);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("reports partial failures and asks for a retry with the same requestId", async () => {
    const bcc = Array.from({ length: 150 }, (_, i) => member(i));
    service({ members: bcc });
    mockBatchSend
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });

    const response = await send({ ...body, bcc });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(
      expect.objectContaining({ sent: 100, retryWithSameRequestId: true })
    );
  });

  describe("ticket claim emails", () => {
    const ticketBody = {
      requestId: REQUEST_ID,
      ticketId: TICKET_ID,
      to: "friend@email.com",
      subject: "Client subject",
      html: "<p>client html</p>",
    };
    const ticket = {
      id: TICKET_ID,
      event_id: EVENT_ID,
      purchased_by_user_id: USER_ID,
      assigned_to_email: "Friend@email.com",
    };

    it("lets the ticket purchaser send the server-generated claim email", async () => {
      const rpc = signIn({ role: null });
      service({ ticket });

      const response = await send(ticketBody);

      expect(response.status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
      const messages = sentMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].to).toBe("friend@email.com");
      expect(messages[0].from).toBe(NOTIFICATIONS_EMAIL_FROM);
      expect(messages[0].subject).not.toBe(ticketBody.subject);
      expect(messages[0].html).not.toContain("client html");
      expect(messages[0].html).toContain("Hack Night");
    });

    it("rejects a caller who did not purchase the ticket", async () => {
      service({ ticket: { ...ticket, purchased_by_user_id: "someone-else" } });

      expect((await send(ticketBody)).status).toBe(403);
      expect(mockBatchSend).not.toHaveBeenCalled();
    });

    it("rejects a to address that does not match the ticket's assigned email", async () => {
      service({ ticket });

      expect((await send({ ...ticketBody, to: "attacker@email.com" })).status).toBe(403);
      expect(mockBatchSend).not.toHaveBeenCalled();
    });

    it("rejects an unknown ticket", async () => {
      service({ ticket: null });

      expect((await send(ticketBody)).status).toBe(403);
      expect(mockBatchSend).not.toHaveBeenCalled();
    });

    it("rejects a non-uuid ticketId", async () => {
      expect((await send({ ...ticketBody, ticketId: "ticket-1" })).status).toBe(400);
      expect(mockBatchSend).not.toHaveBeenCalled();
    });
  });
});
