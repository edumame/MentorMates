/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { PUT } from "./route";

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

jest.mock("@/lib/utils/jwt", () => ({
  verifyProjectInviteToken: jest.fn(),
}));

const mockVerify = verifyProjectInviteToken as jest.Mock;

describe("PUT /api/projects/join", () => {
  const project = {
    id: "project-1",
    lead_email: "lead@email.com",
    teammates: ["friend@email.com"],
    event_id: null as string | null,
  };
  const update = jest.fn();

  const join = (body: unknown = { projectId: "project-1", token: "signed" }) =>
    PUT({ json: async () => body } as never);

  const signIn = (user: { id: string; email?: string } | null) =>
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });

  const withData = (
    row: typeof project | null,
    eventRole: { role: string } | null = { role: "participant" }
  ) =>
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: (table: string) =>
        table === "projects"
          ? {
              select: () => ({
                eq: () => ({
                  maybeSingle: jest
                    .fn()
                    .mockResolvedValue({ data: row, error: null }),
                }),
              }),
              update: (values: unknown) => {
                update(values);
                return { eq: jest.fn().mockResolvedValue({ error: null }) };
              },
            }
          : {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: jest
                      .fn()
                      .mockResolvedValue({ data: eventRole, error: null }),
                  }),
                }),
              }),
            },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    signIn({ id: "user-1", email: "New@Email.com" });
    withData(project);
    mockVerify.mockResolvedValue({
      email: "new@email.com",
      projectId: "project-1",
      invitedBy: "lead@email.com",
    });
  });

  it("rejects anonymous callers", async () => {
    signIn(null);

    expect((await join()).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a project id", async () => {
    expect((await join({ token: "signed" })).status).toBe(400);
  });

  it.each([
    ["no token", { projectId: "project-1" }],
    ["an empty token", { projectId: "project-1", token: "" }],
    ["a non-string token", { projectId: "project-1", token: 1 }],
  ])("rejects %s without checking it", async (_label, body) => {
    expect((await join(body)).status).toBe(403);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a forged or expired token", async () => {
    mockVerify.mockResolvedValue(null);

    expect((await join()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a token for another project", async () => {
    mockVerify.mockResolvedValue({
      email: "new@email.com",
      projectId: "project-2",
      invitedBy: "lead@email.com",
    });

    expect((await join()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an emailed invite used by another account", async () => {
    signIn({ id: "user-2", email: "attacker@email.com" });

    expect((await join()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a copied link, which has no email", async () => {
    mockVerify.mockResolvedValue({
      email: "",
      projectId: "project-1",
      invitedBy: "lead@email.com",
    });

    expect((await join()).status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it("adds the user and returns no project data", async () => {
    const response = await join();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({
      teammates: ["friend@email.com", "New@Email.com"],
    });
  });

  it("returns 404 for a missing project", async () => {
    withData(null);

    expect((await join()).status).toBe(404);
  });

  it.each([
    ["teammate", { ...project, teammates: ["NEW@email.com"] }],
    ["lead", { ...project, lead_email: "NEW@email.com" }],
  ])("does not add an existing %s twice", async (_label, row) => {
    withData(row);

    expect((await join()).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("handles a project with no teammates yet", async () => {
    withData({ ...project, teammates: null as unknown as string[] });

    expect((await join()).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ teammates: ["New@Email.com"] });
  });

  it("requires event registration for event projects", async () => {
    withData({ ...project, event_id: "event-1" }, null);

    expect((await join()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("allows registered users to join event projects", async () => {
    withData({ ...project, event_id: "event-1" });

    expect((await join()).status).toBe(200);
  });
});
