/** @jest-environment node */


import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
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
  const mockCreateSupabaseServiceClient =
    createSupabaseServiceClient as jest.Mock;
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

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "events") {
          return {
            select: jest.fn(() => ({
              eq: eventEq,
            })),
          };
        }

        if (table === "user_event_roles") {
          return {
            upsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    // Hashes are not readable with the user's client, only the service client.
    const rolePasswordSelect = jest.fn(() => ({
      eq: rolePasswordEqEvent,
    }));
    const serviceSupabase = {
      from: jest.fn((table: string) => {
        if (table === "role_passwords") {
          return { select: rolePasswordSelect };
        }

        throw new Error(`Unexpected service table ${table}`);
      }),
    };

    return {
      supabase,
      serviceSupabase,
      rolePasswordSelect,
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
    const { supabase, serviceSupabase, upsert } = buildSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);
    mockCreateSupabaseServiceClient.mockReturnValue(serviceSupabase);

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

  it("reads the role password hash with the service client only", async () => {
    const { supabase, serviceSupabase, rolePasswordSelect, upsert } =
      buildSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);
    mockCreateSupabaseServiceClient.mockReturnValue(serviceSupabase);
    mockCompare.mockResolvedValueOnce(true);

    const response = await POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Judge,
          password: "correct-password",
          userId: "user-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(serviceSupabase.from).toHaveBeenCalledWith("role_passwords");
    expect(rolePasswordSelect).toHaveBeenCalledWith("password_hash");
    expect(supabase.from).not.toHaveBeenCalledWith("role_passwords");
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("does not assign the role when the hash read fails", async () => {
    const { supabase, serviceSupabase, rolePasswordMaybeSingle, upsert } =
      buildSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);
    mockCreateSupabaseServiceClient.mockReturnValue(serviceSupabase);
    rolePasswordMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    const response = await POST(
      new Request("http://localhost/api/roles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Judge,
          password: "correct-password",
          userId: "user-1",
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to verify role password",
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
