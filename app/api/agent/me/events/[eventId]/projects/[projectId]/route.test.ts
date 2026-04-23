/** @jest-environment jsdom */

import { PATCH } from "./route";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getProjectEditAccess } from "@/lib/projects/access";
import { EventRole } from "@/lib/types";

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

jest.mock("@/lib/agent/auth", () => ({
  authenticateAgentRequest: jest.fn(),
  authorizeAgentEventAccess: jest.fn(),
  requireScope: jest.fn(),
  resolveAgentPathEvent: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/projects/access", () => ({
  getProjectEditAccess: jest.fn(),
}));

describe("PATCH /api/agent/me/events/[eventId]/projects/[projectId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireScope as jest.Mock).mockReturnValue(null);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      eventId: "",
      scopes: ["participant-projects:write"],
      keyId: "key-1",
    });
    (resolveAgentPathEvent as jest.Mock).mockReturnValue({
      userId: "user-1",
      eventId: "event-1",
      scopes: ["participant-projects:write"],
      keyId: "key-1",
    });
    (authorizeAgentEventAccess as jest.Mock).mockResolvedValue({
      eventId: "event-1",
      isAdmin: false,
      isOwner: false,
      userRole: EventRole.Participant,
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { email: "participant@example.com" },
              error: null,
            }),
          })),
        })),
      })),
    });
  });

  it("blocks editing a project the participant does not own", async () => {
    (getProjectEditAccess as jest.Mock).mockResolvedValue({
      access: {
        eventId: "event-1",
        isLead: false,
        isTeammate: false,
        isOrganizer: false,
        canEdit: false,
      },
      error: null,
      status: 200,
    });

    const response = await PATCH(
      {
        json: async () => ({ project_name: "Should fail" }),
      } as never,
      {
        params: Promise.resolve({
          eventId: "event-1",
          projectId: "project-1",
        }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized to edit this project",
    });
  });
});
