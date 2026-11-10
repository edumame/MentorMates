/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import {
  authenticateAgentRequest,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(),
  requireScope: jest.fn(),
  resolveAgentPathEvent: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/agent/logging", () => ({
  logAgentEvent: jest.fn(),
}));

describe("POST /api/agent/me/events/[eventId]/join", () => {
  const insertRole = jest.fn();

  const single = (data: unknown) => {
    const result = { data, error: null };
    const chain = {
      select: jest.fn((): unknown => chain),
      eq: jest.fn((): unknown => chain),
      order: jest.fn((): unknown => chain),
      limit: jest.fn((): unknown => chain),
      maybeSingle: jest.fn(() => ({
        overrideTypes: jest.fn().mockResolvedValue(result),
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      })),
      insert: insertRole,
    };
    return chain;
  };

  const mockTables = (event: Record<string, unknown>, rolePassword: unknown) => {
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => {
        switch (table) {
          case "events":
            return single({
              event_id: "event-1",
              event_name: "Hack Day",
              visibility: "public",
              approval_status: "approved",
              require_participant_approval: false,
              participant_capacity: null,
              paid: false,
              ...event,
            });
          case "role_passwords":
            return single(rolePassword);
          case "user_event_roles":
          case "event_intake_form_bindings":
            return single(null);
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    });
  };

  const post = () =>
    POST(
      new NextRequest("http://localhost/api/agent/me/events/event-1/join", {
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    insertRole.mockResolvedValue({ error: null });
    const auth = { userId: "user-1", eventId: "event-1", scopes: [] };
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(auth);
    (requireScope as jest.Mock).mockReturnValue(null);
    (resolveAgentPathEvent as jest.Mock).mockResolvedValue(auth);
  });

  it("joins a public, approved event with no participant password", async () => {
    mockTables({}, null);

    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(insertRole).toHaveBeenCalled();
  });

  it("rejects an event with a participant password", async () => {
    mockTables({}, { event_id: "event-1" });

    const response = await post();

    expect(response.status).toBe(403);
    expect(insertRole).not.toHaveBeenCalled();
  });

  it("rejects a draft event", async () => {
    mockTables({ visibility: "draft" }, null);

    const response = await post();

    expect(response.status).toBe(403);
    expect(insertRole).not.toHaveBeenCalled();
  });

  it("rejects an unapproved event", async () => {
    mockTables({ approval_status: "submitted" }, null);

    const response = await post();

    expect(response.status).toBe(403);
    expect(insertRole).not.toHaveBeenCalled();
  });
});
