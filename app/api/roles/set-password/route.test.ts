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
  hash: jest.fn(),
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("POST /api/roles/set-password", () => {
  const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
  const mockCreateSupabaseServiceClient =
    createSupabaseServiceClient as jest.Mock;
  const mockHash = bcrypt.hash as jest.Mock;

  const setUp = ({
    user = { id: "user-1" } as { id: string } | null,
    callerRole = EventRole.Organizer as EventRole | null,
    upsertError = null as { message: string } | null,
  } = {}) => {
    const roleSingle = jest.fn().mockResolvedValue({
      data: callerRole ? { role: callerRole } : null,
      error: null,
    });
    const roleEqEvent = jest.fn(() => ({ single: roleSingle }));
    const roleEqUser = jest.fn(() => ({ eq: roleEqEvent }));

    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user } }),
      },
      from: jest.fn((table: string) => {
        if (table === "user_event_roles") {
          return { select: jest.fn(() => ({ eq: roleEqUser })) };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const upsert = jest.fn().mockResolvedValue({ error: upsertError });
    const serviceSupabase = {
      from: jest.fn((table: string) => {
        if (table === "role_passwords") {
          return { upsert };
        }

        throw new Error(`Unexpected service table ${table}`);
      }),
    };

    mockCreateSupabaseClient.mockResolvedValue(supabase);
    mockCreateSupabaseServiceClient.mockReturnValue(serviceSupabase);
    mockHash.mockResolvedValue("new-hash");

    return { supabase, serviceSupabase, upsert };
  };

  const post = () =>
    POST(
      new Request("http://localhost/api/roles/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event-1",
          role: EventRole.Judge,
          password: "new-password",
        }),
      })
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes the hash with the service client for an organizer", async () => {
    const { supabase, upsert } = setUp();

    const response = await post();

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-1",
        role: EventRole.Judge,
        password_hash: "new-hash",
      }),
      { onConflict: "event_id,role" }
    );
    expect(supabase.from).not.toHaveBeenCalledWith("role_passwords");
  });

  it("rejects an unauthenticated caller before writing", async () => {
    const { upsert } = setUp({ user: null });

    const response = await post();

    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([[EventRole.Participant], [EventRole.Judge], [null]])(
    "rejects a caller with role %s before writing",
    async (callerRole) => {
      const { upsert } = setUp({ callerRole });

      const response = await post();

      expect(response.status).toBe(403);
      expect(upsert).not.toHaveBeenCalled();
    }
  );

  it("reports a failed write", async () => {
    setUp({ upsertError: { message: "boom" } });

    const response = await post();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to set password",
    });
  });
});
