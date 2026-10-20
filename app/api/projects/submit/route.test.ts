/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { saveProjectSubmission } from "@/lib/projects/submission-service";

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

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/projects/submission-service", () => {
  const actual = jest.requireActual("@/lib/projects/submission-service");
  return {
    ...actual,
    saveProjectSubmission: jest.fn(),
  };
});

describe("POST /api/projects/submit", () => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enforces max_projects per participant across lead and teammate submissions", async () => {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          event_id: eventId,
          submission_time_start: "2026-04-17T00:00:00.000Z",
          submission_time_cutoff: "2026-04-19T00:00:00.000Z",
          max_projects: 2,
        },
        error: null,
      }),
    };

    const projectsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    };
    projectsQuery.eq = jest
      .fn()
      .mockReturnValueOnce(projectsQuery)
      .mockResolvedValue({
        data: [
          {
            id: "project-1",
            lead_email: "participant@example.com",
            teammates: ["friend@example.com"],
          },
          {
            id: "project-2",
            lead_email: "someone@example.com",
            teammates: ["Participant@Example.com"],
          },
          {
            id: "project-3",
            lead_email: "other@example.com",
            teammates: ["another@example.com"],
          },
        ],
        error: null,
      });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "participant@example.com",
            },
          },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "events") {
          return eventsQuery;
        }

        if (table === "projects") {
          return projectsQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request("https://mentormates.ai/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          projectName: "New Project",
          leadName: "Participant",
          leadEmail: "participant@example.com",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "You have reached the maximum of 2 submitted projects for this event.",
      max_projects: 2,
      current_count: 2,
    });
    expect(saveProjectSubmission).not.toHaveBeenCalled();
  });

  it("allows project updates even when the participant is already at the event cap", async () => {
    const eventsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          event_id: eventId,
          max_projects: 1,
        },
        error: null,
      }),
    };

    const projectsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: "project-1",
            lead_email: "participant@example.com",
            teammates: [],
          },
        ],
        error: null,
      }),
    };

    (saveProjectSubmission as jest.Mock).mockResolvedValue({
      status: 200,
      project: { id: projectId, project_name: "Updated Project" },
    });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "participant@example.com",
            },
          },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "events") {
          return eventsQuery;
        }

        if (table === "projects") {
          return projectsQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request("https://mentormates.ai/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          eventId,
          projectName: "Updated Project",
          leadName: "Participant",
          leadEmail: "participant@example.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { id: projectId, project_name: "Updated Project" },
    });
    expect(saveProjectSubmission).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: "update",
        projectId,
      }),
    );
    expect(projectsQuery.select).not.toHaveBeenCalled();
  });
});
