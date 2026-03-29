/**
 * @jest-environment node
 */

import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://mentormates.ai";
  });

  it("verifies the email token and redirects confirmed users to the requested path", async () => {
    const profileBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          uid: "user-1",
          onboarding_metadata: { role: "founder" },
        },
        error: null,
      }),
    };

    const supabase = {
      auth: {
        verifyOtp: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "founder@example.com",
              user_metadata: { full_name: "Founder" },
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "user_profiles") {
          return profileBuilder;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    (createSupabaseClient as jest.Mock).mockResolvedValue(supabase);

    const response = await GET(
      new Request(
        "https://mentormates.ai/auth/confirm?token_hash=test-hash&type=email&redirect_to=https%3A%2F%2Fmentormates.ai%2Fprojects"
      )
    );

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "test-hash",
      type: "email",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://mentormates.ai/projects");
  });

  it("sends newly confirmed users through onboarding before returning them to their destination", async () => {
    const profileLookupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      }),
    };

    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    const supabase = {
      auth: {
        verifyOtp: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              email: "new-user@example.com",
              user_metadata: { full_name: "New User" },
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table !== "user_profiles") {
          throw new Error(`Unexpected table: ${table}`);
        }

        if (supabase.from.mock.calls.length === 1) {
          return profileLookupBuilder;
        }

        return insertBuilder;
      }),
    };

    (createSupabaseClient as jest.Mock).mockResolvedValue(supabase);

    const response = await GET(
      new Request(
        "https://mentormates.ai/auth/confirm?token_hash=test-hash&type=email&redirect_to=https%3A%2F%2Fmentormates.ai%2Fprojects%2Fsubmit"
      )
    );

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      uid: "user-2",
      display_name: "New User",
      email: "new-user@example.com",
      created_at: expect.any(String),
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://mentormates.ai/onboarding?returnUrl=%2Fprojects%2Fsubmit"
    );
  });

  it("ignores external redirect targets after confirmation", async () => {
    const profileBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          uid: "user-3",
          onboarding_metadata: { role: "mentor" },
        },
        error: null,
      }),
    };

    const supabase = {
      auth: {
        verifyOtp: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-3",
              email: "mentor@example.com",
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "user_profiles") {
          return profileBuilder;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    (createSupabaseClient as jest.Mock).mockResolvedValue(supabase);

    const response = await GET(
      new Request(
        "https://mentormates.ai/auth/confirm?token_hash=test-hash&type=email&redirect_to=https%3A%2F%2Fevil.example%2Fphish"
      )
    );

    expect(response.headers.get("location")).toBe("https://mentormates.ai/");
  });
});
