/**
 * @jest-environment node
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { POST } from "./route";

const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;
const mockVerifyProjectInviteToken = verifyProjectInviteToken as jest.Mock;

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/utils/jwt", () => ({
  verifyProjectInviteToken: jest.fn(),
}));

const validPayload = {
  email: "invitee@example.com",
  projectId: "project-1",
  invitedBy: "lead@example.com",
};

function mockProjectLookup(result: { data: unknown; error: unknown }) {
  const eq = jest.fn().mockReturnValue({
    maybeSingle: jest.fn().mockResolvedValue(result),
  });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  mockCreateSupabaseServiceClient.mockReturnValue({ from });
  return { from, select, eq };
}

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/projects/verify-invite-token", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/projects/verify-invite-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a project preview through the service client for a valid token", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(validPayload);
    const { from, select, eq } = mockProjectLookup({
      data: {
        id: "project-1",
        project_name: "Secret Project",
        project_description: "Hidden by RLS",
        lead_name: "Lead",
        event_id: "event-1",
        event: { event_name: "Hack Night", event_date: "2026-11-20" },
      },
      error: null,
    });

    const response = await post({ token: "t", projectId: "project-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: true,
      email: "invitee@example.com",
      invitedBy: "lead@example.com",
      project: {
        id: "project-1",
        project_name: "Secret Project",
        project_description: "Hidden by RLS",
        lead_name: "Lead",
        event_id: "event-1",
        event: { event_name: "Hack Night", event_date: "2026-11-20" },
      },
    });
    expect(from).toHaveBeenCalledWith("projects");
    expect(eq).toHaveBeenCalledWith("id", "project-1");
    // The caller may be anonymous, so member emails must never be selected.
    const columns = select.mock.calls[0][0] as string;
    expect(columns).not.toMatch(/lead_email|teammates/);
  });

  it("normalizes an event returned as an array", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(validPayload);
    mockProjectLookup({
      data: {
        id: "project-1",
        project_name: "Secret Project",
        project_description: null,
        lead_name: "Lead",
        event_id: "event-1",
        event: [{ event_name: "Hack Night", event_date: "2026-11-20" }],
      },
      error: null,
    });

    const response = await post({ token: "t", projectId: "project-1" });
    const body = await response.json();

    expect(body.project.event).toEqual({
      event_name: "Hack Night",
      event_date: "2026-11-20",
    });
  });

  it("does not read the project for an invalid token", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(null);

    const response = await post({ token: "bad", projectId: "project-1" });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.valid).toBe(false);
    expect(body).not.toHaveProperty("project");
    expect(mockCreateSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("does not read the project when the token is for a different project", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue({
      ...validPayload,
      projectId: "other-project",
    });

    const response = await post({ token: "t", projectId: "project-1" });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.valid).toBe(false);
    expect(body).not.toHaveProperty("project");
    expect(mockCreateSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("keeps the token valid with no preview when the project no longer exists", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(validPayload);
    mockProjectLookup({ data: null, error: null });

    const response = await post({ token: "t", projectId: "project-1" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.project).toBeNull();
  });

  it("keeps the token valid with no preview when the lookup fails", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(validPayload);
    mockProjectLookup({ data: null, error: { message: "boom" } });

    const response = await post({ token: "t", projectId: "project-1" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.project).toBeNull();
  });

  it("keeps the token valid with no preview when the service client throws", async () => {
    mockVerifyProjectInviteToken.mockResolvedValue(validPayload);
    mockCreateSupabaseServiceClient.mockImplementation(() => {
      throw new Error("missing service key");
    });

    const response = await post({ token: "t", projectId: "project-1" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.project).toBeNull();
  });
});
