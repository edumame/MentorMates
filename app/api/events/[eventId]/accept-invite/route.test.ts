/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { verifyEventRoleInviteToken } from "@/lib/utils/jwt";
import { POST } from "./route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/utils/jwt", () => ({
  verifyEventRoleInviteToken: jest.fn(),
}));

const mockVerify = verifyEventRoleInviteToken as jest.Mock;

describe("POST /api/events/[eventId]/accept-invite", () => {
  const upsert = jest.fn();
  const maybeSingle = jest.fn();

  const accept = (body: unknown = { token: "signed-token" }) =>
    POST(
      new Request("http://localhost/api/events/event-1/accept-invite", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

  const signIn = (user: { id: string; email?: string } | null) =>
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
        upsert,
      }),
    });
    signIn({ id: "user-1", email: "Judge@Email.com" });
    mockVerify.mockResolvedValue({
      email: "judge@email.com",
      eventId: "event-1",
      role: EventRole.Judge,
    });
  });

  it("requires a signed-in user", async () => {
    signIn(null);

    expect((await accept()).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ token: "" }], [{ token: 123 }]])(
    "rejects a missing or malformed token: %j",
    async (body) => {
      expect((await accept(body)).status).toBe(403);
      expect(mockVerify).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    }
  );

  it("rejects a forged or expired token", async () => {
    mockVerify.mockResolvedValue(null);

    expect((await accept()).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a token issued for another event", async () => {
    mockVerify.mockResolvedValue({
      email: "judge@email.com",
      eventId: "event-2",
      role: EventRole.Judge,
    });

    expect((await accept()).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a token issued to another email", async () => {
    signIn({ id: "user-1", email: "attacker@email.com" });

    expect((await accept()).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("assigns the role from the token, ignoring any role in the body", async () => {
    const response = await accept({
      token: "signed-token",
      role: EventRole.Organizer,
    });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        event_id: "event-1",
        role: EventRole.Judge,
      }),
      { onConflict: "user_id,event_id" }
    );
  });

  it("never downgrades someone who already has more access", async () => {
    maybeSingle.mockResolvedValue({
      data: { role: EventRole.Organizer },
      error: null,
    });

    expect((await accept()).status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns a generic error when the role write fails", async () => {
    upsert.mockResolvedValue({ error: { message: "internal detail" } });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const response = await accept();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to accept invitation",
    });
    spy.mockRestore();
  });
});
