/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { consumeInvite, getPendingInvite, releaseInvite } from "@/lib/events/role-invitations";
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

jest.mock("@/lib/events/role-invitations", () => ({
  getPendingInvite: jest.fn(),
  consumeInvite: jest.fn(),
  releaseInvite: jest.fn(),
}));

const mockVerify = getPendingInvite as jest.Mock;
const mockConsume = consumeInvite as jest.Mock;

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
    mockVerify.mockImplementation(async (token: string | null) =>
      token
        ? { email: "judge@email.com", eventId: "event-1", role: EventRole.Judge, jti: "inv-1" }
        : null
    );
    mockConsume.mockResolvedValue(true);
    (releaseInvite as jest.Mock).mockResolvedValue(undefined);
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
      expect(mockConsume).not.toHaveBeenCalled();
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
      jti: "inv-1",
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

  // ORG-012 round 2: links are single-use and revocable.
  it("consumes the invitation and refuses a reused, revoked or expired link", async () => {
    expect((await accept()).status).toBe(200);
    expect(mockConsume).toHaveBeenCalledWith("inv-1", "user-1");

    upsert.mockClear();
    mockConsume.mockResolvedValue(false);
    expect((await accept()).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("releases the invitation when granting the role fails", async () => {
    upsert.mockResolvedValue({ error: { message: "x" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect((await accept()).status).toBe(500);
    expect(releaseInvite).toHaveBeenCalledWith("inv-1");
  });
});
