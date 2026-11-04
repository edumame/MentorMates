/** @jest-environment node */


import * as bcrypt from "bcrypt";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import {
  hasPaidEventAccess,
  joinParticipantEvent,
} from "@/lib/events/participant-access";
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

jest.mock("@/lib/events/participant-access", () => ({
  joinParticipantEvent: jest.fn(),
  hasPaidEventAccess: jest.fn(),
}));

describe("POST /api/roles/verify", () => {
  const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
  const mockCompare = bcrypt.compare as jest.Mock;
  const mockHasPaidEventAccess = hasPaidEventAccess as jest.Mock;
  const mockJoinParticipantEvent = joinParticipantEvent as jest.Mock;

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

        if (table === "role_passwords") {
          return {
            select: jest.fn(() => ({
              eq: rolePasswordEqEvent,
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

    return {
      supabase,
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

  describe("paid events", () => {
    const buildPaidEventSupabase = () => {
      const built = buildSupabase();
      built.eventEq.mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { event_id: "event-1", paid: true },
          error: null,
        }),
      });
      built.rolePasswordMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      mockCreateSupabaseClient.mockResolvedValue(built.supabase);
      return built;
    };

    const postRole = (role: EventRole) =>
      POST(
        new Request("http://localhost/api/roles/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: "event-1", role, userId: "user-1" }),
        })
      );

    it("refuses a mentor who has not paid", async () => {
      const { upsert } = buildPaidEventSupabase();
      mockHasPaidEventAccess.mockResolvedValue({ allowed: false, failed: false });

      const response = await postRole(EventRole.Mentor);

      expect(response.status).toBe(402);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("fails closed when the mentor payment lookup errors", async () => {
      const { upsert } = buildPaidEventSupabase();
      mockHasPaidEventAccess.mockResolvedValue({ allowed: false, failed: true });

      const response = await postRole(EventRole.Mentor);

      expect(response.status).toBe(500);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("assigns a mentor who has paid", async () => {
      const { upsert } = buildPaidEventSupabase();
      mockHasPaidEventAccess.mockResolvedValue({ allowed: true, failed: false });

      const response = await postRole(EventRole.Mentor);

      expect(response.status).toBe(200);
      expect(upsert).toHaveBeenCalled();
    });

    it("does not charge judges", async () => {
      const { upsert } = buildPaidEventSupabase();

      const response = await postRole(EventRole.Judge);

      expect(response.status).toBe(200);
      expect(mockHasPaidEventAccess).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalled();
    });

    it("leaves the participant payment check to joinParticipantEvent", async () => {
      buildPaidEventSupabase();
      mockJoinParticipantEvent.mockResolvedValue({
        status: "error",
        httpStatus: 402,
        payload: { error: "Payment required to join this event." },
      });

      const response = await postRole(EventRole.Participant);

      expect(response.status).toBe(402);
      expect(mockHasPaidEventAccess).not.toHaveBeenCalled();
    });
  });
});
