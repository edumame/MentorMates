/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ONBOARDING_SKIP_STATUS } from "@/features/user/onboarding/metadata";

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

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts skipped onboarding payloads and persists them", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        update,
      }),
    });

    const response = await POST(
      new Request("https://mentormates.ai/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: 4,
          status: ONBOARDING_SKIP_STATUS,
          skippedAt: "2026-04-03T12:00:00.000Z",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({
      onboarding_metadata: {
        version: 4,
        status: ONBOARDING_SKIP_STATUS,
        skippedAt: "2026-04-03T12:00:00.000Z",
      },
    });
    expect(eq).toHaveBeenCalledWith("uid", "user-123");
  });
});
