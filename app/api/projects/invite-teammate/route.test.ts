/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const mockResendSend = jest.fn();
const mockSetExpirationTime = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

// Team email columns are not client-readable, so the route reads the project
// with the service client.
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

// jose ships ESM that jest cannot load, so the signer is replaced. The real
// lib/utils/jwt still runs, which keeps the lifetime handed to jose under test.
jest.mock("jose", () => ({
  SignJWT: jest.fn().mockImplementation(() => {
    const signer = {
      setProtectedHeader: () => signer,
      setIssuedAt: () => signer,
      setExpirationTime: (expiry: string) => {
        mockSetExpirationTime(expiry);
        return signer;
      },
      sign: async () => "signed-token",
    };
    return signer;
  }),
}));

function mockSupabase() {
  const rows: Record<string, unknown> = {
    projects: {
      id: "project-1",
      project_name: "Rocket",
      lead_email: "lead@example.com",
      teammates: [],
      event_id: null,
    },
    user_profiles: { email: "lead@example.com", display_name: "Lead" },
  };

  const from = (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({ data: rows[table], error: null }),
    };
    return query;
  };

  // Authorization uses the verified auth email, not the profile email.
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "lead-id", email: "lead@example.com" } },
      }),
    },
    from,
  });
  mockCreateServiceClient.mockReturnValue({ from });
}

describe("POST /api/projects/invite-teammate", () => {
  const originalEnv = process.env;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://mentormates.ai",
      RESEND_API_KEY: "resend-key",
      // lib/utils/jwt refuses to sign without a configured secret.
      JWT_SECRET: "test-jwt-secret",
    };
    // Imported here because the route reads RESEND_API_KEY at load time.
    ({ POST } = await import("./route"));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockResendSend.mockResolvedValue({ error: null });
    mockSupabase();
  });

  async function sendInvite() {
    const response = await POST(
      new Request("https://mentormates.ai/api/projects/invite-teammate", {
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          email: "friend@example.com",
        }),
      })
    );
    expect(response.status).toBe(200);
    return mockResendSend.mock.calls[0][0] as { html: string };
  }

  it("signs the emailed link for 7 days, long enough to sign up and register", async () => {
    const { html } = await sendInvite();

    expect(mockSetExpirationTime).toHaveBeenCalledWith(`${7 * 24 * 60 * 60}s`);
    expect(html).toContain("token=signed-token");
  });

  it("states the same limit in the email that the token enforces", async () => {
    const { html } = await sendInvite();

    expect(html).toContain("expires in 7 days");
  });
});
