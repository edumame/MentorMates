import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/utils/jwt", () => ({
  verifyProjectInviteToken: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => payload,
    }),
  },
}));

const mockedCreateSupabaseClient = jest.mocked(createSupabaseClient);
const mockedCreateSupabaseServiceClient = jest.mocked(createSupabaseServiceClient);
const mockedVerifyProjectInviteToken = jest.mocked(verifyProjectInviteToken);

let putRoute: typeof import("./route").PUT;

class MockRequest {
  private readonly body: string;

  constructor(_input: string, init?: { body?: string }) {
    this.body = init?.body || "";
  }

  async json() {
    return JSON.parse(this.body || "{}");
  }
}

class MockResponse {
  readonly status: number;
  private readonly payload: unknown;

  constructor(payload: unknown, init?: { status?: number }) {
    this.payload = payload;
    this.status = init?.status ?? 200;
  }

  static json(payload: unknown, init?: { status?: number }) {
    return new MockResponse(payload, init);
  }

  async json() {
    return this.payload;
  }
}

function buildAuthClient(email = "invitee@example.com") {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1", email } },
        error: null,
      }),
    },
  };
}

function buildServiceClient(projectOverrides: Record<string, unknown> = {}) {
  return {
    from: jest.fn((table: string) => {
      if (table !== "projects") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "project-1",
                lead_email: "lead@example.com",
                teammates: ["existing@example.com"],
                ...projectOverrides,
              },
              error: null,
            }),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: "project-1",
                  teammates: ["existing@example.com", "invitee@example.com"],
                },
                error: null,
              }),
            })),
          })),
        })),
      };
    }),
  };
}

describe("PUT /api/projects/join", () => {
  beforeAll(async () => {
    global.Request = MockRequest as never;
    global.Response = MockResponse as never;
    ({ PUT: putRoute } = await import("./route"));
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rejects join requests without a token", async () => {
    mockedCreateSupabaseClient.mockResolvedValue(buildAuthClient() as never);
    mockedCreateSupabaseServiceClient.mockReturnValue(buildServiceClient() as never);

    const response = await putRoute(
      new Request("http://localhost/api/projects/join", {
        method: "PUT",
        body: JSON.stringify({ projectId: "project-1" }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing projectId or token",
    });
  });

  it("rejects invite links for the wrong signed-in email", async () => {
    mockedCreateSupabaseClient.mockResolvedValue(
      buildAuthClient("other@example.com") as never
    );
    mockedCreateSupabaseServiceClient.mockReturnValue(buildServiceClient() as never);
    mockedVerifyProjectInviteToken.mockResolvedValue({
      email: "invitee@example.com",
      projectId: "project-1",
      invitedBy: "lead@example.com",
    });

    const response = await putRoute(
      new Request("http://localhost/api/projects/join", {
        method: "PUT",
        body: JSON.stringify({ projectId: "project-1", token: "valid-token" }),
      }) as never
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "This invitation was sent to invitee@example.com. Please sign in with that account.",
    });
  });

  it("returns success without duplicating teammates when the user already joined", async () => {
    mockedCreateSupabaseClient.mockResolvedValue(buildAuthClient() as never);
    mockedCreateSupabaseServiceClient.mockReturnValue(
      buildServiceClient({
        teammates: ["existing@example.com", "invitee@example.com"],
      }) as never
    );
    mockedVerifyProjectInviteToken.mockResolvedValue({
      email: "invitee@example.com",
      projectId: "project-1",
      invitedBy: "lead@example.com",
    });

    const response = await putRoute(
      new Request("http://localhost/api/projects/join", {
        method: "PUT",
        body: JSON.stringify({ projectId: "project-1", token: "valid-token" }),
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      already_member: true,
      project: {
        id: "project-1",
        lead_email: "lead@example.com",
        teammates: ["existing@example.com", "invitee@example.com"],
      },
    });
  });
});
