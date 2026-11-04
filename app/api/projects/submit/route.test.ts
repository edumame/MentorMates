/** @jest-environment jsdom */

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

jest.mock("@/lib/projects/submission-service", () => ({
  ...jest.requireActual("@/lib/projects/submission-service"),
  saveProjectSubmission: jest.fn(),
}));

describe("POST /api/projects/submit", () => {
  const projectId = "22222222-2222-4222-8222-222222222222";
  const callerEmail = "teammate@example.com";

  const post = (body: unknown) =>
    POST({ json: async () => body } as unknown as Request);

  const savedOptions = () =>
    (saveProjectSubmission as jest.Mock).mock.calls[0][1];

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: callerEmail } },
          error: null,
        }),
      },
    });
    (saveProjectSubmission as jest.Mock).mockResolvedValue({
      status: 200,
      project: { id: projectId },
    });
  });

  it("does not make the caller the lead when submitting an existing project", async () => {
    const response = await post({ projectId, submitted: true });

    expect(response.status).toBe(200);
    expect(savedOptions()).toMatchObject({ mode: "update", projectId });
    expect(savedOptions().input.leadEmail).toBeUndefined();
  });

  it("treats project_id the same as projectId", async () => {
    await post({ project_id: projectId, submitted: true });

    expect(savedOptions()).toMatchObject({ mode: "update", projectId });
    expect(savedOptions().input.leadEmail).toBeUndefined();
  });

  it("defaults the lead to the caller when creating a project", async () => {
    await post({ projectName: "New", projectDescription: "Description" });

    expect(savedOptions().mode).toBe("create");
    expect(savedOptions().input.leadEmail).toBe(callerEmail);
  });

  it("keeps an explicit lead email when creating a project", async () => {
    await post({
      projectName: "New",
      projectDescription: "Description",
      lead_email: "lead@example.com",
    });

    expect(savedOptions().mode).toBe("create");
    expect(savedOptions().input.leadEmail).toBe("lead@example.com");
  });
});
