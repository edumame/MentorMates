/** @jest-environment node */


import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { joinParticipantEvent } from "@/lib/events/participant-access";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { POST } from "./route";

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private readonly body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/events/participant-access", () => ({
  joinParticipantEvent: jest.fn(),
}));

describe("POST /api/roles/verify", () => {
  const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
  const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;
  const mockJoinParticipantEvent = joinParticipantEvent as jest.Mock;
  const mockCompare = bcrypt.compare as jest.Mock;

  const buildSupabase = () => {
    const rolePasswordEqRole = jest.fn();
    const rolePasswordEqEvent = jest.fn(() => ({
      eq: rolePasswordEqRole,
    }));
    const rolePasswordMaybeSingle = jest.fn().mockResolvedValue({
      data: { password_hash: "stored-hash" },
      error: null,
    });

    rolePasswordEqRole.mockReturnValue({
      maybeSingle: rolePasswordMaybeSingle,
    });

    const eventMaybeSingle = jest.fn().mockResolvedValue({
      data: { event_id: "event-1" },
      error: null,
    });
    const eventEq = jest.fn(() => ({
      maybeSingle: eventMaybeSingle,
    }));

    const upsert = jest.fn().mockResolvedValue({ error: null });

    const service = { from: jest.fn(() => ({ upsert })) };
    mockCreateServiceClient.mockReturnValue(service);

    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "events") {
          return {
            select: jest.fn(() => ({
              eq: eventEq,
            })),
          };
        }

        if (table === "role_passwords") {
          return {
            select: jest.fn(() => ({
              eq: rolePasswordEqEvent,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    return {
      supabase,
      service,
      upsert,
      eventEq,
      rolePasswordEqEvent,
      rolePasswordEqRole,
      rolePasswordMaybeSingle,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enforces mentor role passwords when configured", async () => {
    const { supabase, upsert } = buildSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);

    const missingPasswordResponse = await POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Mentor,
          userId: "user-1",
        }),
      })
    );

    expect(missingPasswordResponse.status).toBe(400);
    await expect(missingPasswordResponse.json()).resolves.toEqual({
      error: "Password required for this role",
    });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    mockCompare.mockResolvedValueOnce(false);

    const wrongPasswordResponse = await POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Mentor,
          password: "wrong-password",
          userId: "user-1",
        }),
      })
    );

    expect(wrongPasswordResponse.status).toBe(401);
    await expect(wrongPasswordResponse.json()).resolves.toEqual({
      error: "Invalid password",
    });
    expect(mockCompare).toHaveBeenCalledWith(
      "wrong-password",
      "stored-hash"
    );
    expect(upsert).not.toHaveBeenCalled();

    mockCompare.mockResolvedValueOnce(true);

    const successResponse = await POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Mentor,
          password: "correct-password",
          userId: "user-1",
        }),
      })
    );

    expect(successResponse.status).toBe(200);
    await expect(successResponse.json()).resolves.toEqual({
      success: true,
      message: "Role assigned successfully",
    });
    expect(mockCompare).toHaveBeenLastCalledWith(
      "correct-password",
      "stored-hash"
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        event_id: "event-1",
        role: EventRole.Mentor,
      }),
      { onConflict: "user_id,event_id" }
    );
  });

  const postRole = (body: Record<string, unknown>) =>
    POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: "event-1", ...body }),
      })
    );

  const withNoRolePassword = (
    harness: ReturnType<typeof buildSupabase>
  ) => {
    harness.rolePasswordMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockCreateSupabaseClient.mockResolvedValue(harness.supabase);
    return harness;
  };

  it("rejects unauthenticated callers even with a userId in the body", async () => {
    const { supabase, upsert } = buildSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockCreateSupabaseClient.mockResolvedValue(supabase);

    const response = await postRole({
      role: EventRole.Mentor,
      userId: "victim",
    });

    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("assigns the role to the session user, not the userId in the body", async () => {
    const { upsert } = withNoRolePassword(buildSupabase());

    const response = await postRole({
      role: EventRole.Mentor,
      userId: "victim",
    });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
      expect.anything()
    );
  });

  it("never allows the admin role to be self-assigned", async () => {
    const { upsert } = withNoRolePassword(buildSupabase());

    const response = await postRole({ role: EventRole.Admin });

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([EventRole.Organizer, EventRole.Judge])(
    "requires an invitation for %s when no password is configured",
    async (role) => {
      const { upsert } = withNoRolePassword(buildSupabase());

      const response = await postRole({ role });

      expect(response.status).toBe(403);
      expect(upsert).not.toHaveBeenCalled();
    }
  );

  it("still allows organizer access with the configured password", async () => {
    const { supabase, upsert } = buildSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);
    mockCompare.mockResolvedValueOnce(true);

    const response = await postRole({
      role: EventRole.Organizer,
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: EventRole.Organizer }),
      expect.anything()
    );
  });

  it("joins participants as the session user through the service client", async () => {
    const { service } = withNoRolePassword(buildSupabase());
    mockJoinParticipantEvent.mockResolvedValue({
      status: "joined",
      requiresApproval: false,
    });

    await postRole({ role: EventRole.Participant, userId: "victim" });

    expect(mockJoinParticipantEvent).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ userId: "user-1", channel: "web" })
    );
  });
});
