/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

const mockSend = jest.fn();

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
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const member = (i: number) => `member${i}@email.com`;

describe("POST /api/email_notification", () => {
  const body = {
    eventId: "event-1",
    subject: "Schedule update",
    html: "<p>Hello</p>",
    bcc: [member(1), member(2)],
  };

  const send = (payload: unknown = body) =>
    POST({ json: async () => payload } as never);

  const signIn = ({
    user = { id: "user-1" } as { id: string } | null,
    role = EventRole.Organizer as EventRole | null,
    isAdmin = false,
  } = {}) =>
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: role ? { role } : null,
              }),
            }),
          }),
        }),
      }),
      rpc: jest.fn().mockResolvedValue({ data: isAdmin }),
    });

  const eventMembers = (emails: string[]) => {
    const inFilter = jest.fn((_column: string, batch: string[]) =>
      Promise.resolve({
        data: batch
          .filter((email) => emails.includes(email))
          .map((email) => ({ user_profiles: { email } })),
        error: null,
      })
    );
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ in: inFilter }) }) }),
    });
    return inFilter;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ error: null });
    signIn();
    eventMembers(body.bcc);
  });

  it("rejects anonymous callers", async () => {
    signIn({ user: null });

    expect((await send()).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it.each([
    ["a participant", EventRole.Participant],
    ["a mentor", EventRole.Mentor],
    ["a judge", EventRole.Judge],
    ["a non-member", null],
  ])("rejects %s", async (_label, role) => {
    signIn({ role });

    expect((await send()).status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("allows platform admins who aren't in the event", async () => {
    signIn({ role: null, isAdmin: true });

    expect((await send()).status).toBe(200);
  });

  it.each([
    ["no event", { ...body, eventId: undefined }],
    ["no recipients", { ...body, bcc: [] }],
    ["an invalid recipient", { ...body, bcc: ["not-an-email"] }],
    ["no subject", { ...body, subject: "" }],
    ["a non-object body", null],
  ])("rejects a request with %s", async (_label, payload) => {
    expect((await send(payload)).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses the whole send if any recipient is outside the event", async () => {
    const response = await send({
      ...body,
      bcc: [member(1), "stranger@email.com"],
    });

    expect(response.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("ignores a sender and direct recipients supplied by the client", async () => {
    await send({
      ...body,
      from: "ceo@mentormates.ai",
      to: "victim@email.com",
      cc: ["victim@email.com"],
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = mockSend.mock.calls[0][0];
    expect(message.from).not.toContain("ceo@");
    expect(message.to).toBe("admin@mentormates.ai");
    expect(message.cc).toBeUndefined();
    expect(message.bcc).toEqual(body.bcc);
  });

  it("removes duplicate recipients", async () => {
    await send({ ...body, bcc: [member(1), member(1)] });

    expect(mockSend.mock.calls[0][0].bcc).toEqual([member(1)]);
  });

  it("batches large sends and looks members up in chunks", async () => {
    const bcc = Array.from({ length: 150 }, (_, i) => member(i));
    const inFilter = eventMembers(bcc);

    const response = await send({ ...body, bcc });

    expect(response.status).toBe(200);
    expect(inFilter).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls.map(([m]) => m.bcc.length)).toEqual([
      49, 49, 49, 3,
    ]);
  });

  it("reports partial failures", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockResolvedValueOnce({ error: { message: "rate limited" } });

    const response = await send();

    expect(response.status).toBe(422);
    spy.mockRestore();
  });
});
