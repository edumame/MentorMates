/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const mockCreateCompletion = jest.fn();
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreateCompletion } },
  })),
}));

function chatRequest(body: unknown = { message: "hi", event: {} }) {
  return new NextRequest("http://localhost/api/events/ai-chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockAuth(result: { user: unknown; error?: unknown }) {
  mockCreateSupabaseClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: result.user },
        error: result.error ?? null,
      }),
    },
  });
}

describe("POST /api/events/ai-chat", () => {
  const originalEnv = process.env;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    // The route builds its OpenAI client at import time from this key.
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    ({ POST } = await import("./route"));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: "Hello there" } }],
    });
  });

  it("returns 401 and does not call OpenAI for a signed-out caller", async () => {
    mockAuth({ user: null });

    const response = await POST(chatRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it("returns 401 and does not call OpenAI when the session cannot be verified", async () => {
    mockAuth({ user: { id: "user-1" }, error: new Error("invalid JWT") });

    const response = await POST(chatRequest());

    expect(response.status).toBe(401);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it("returns 401 for a signed-out caller before validating the body", async () => {
    mockAuth({ user: null });

    const response = await POST(chatRequest("not json"));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a signed-out caller when OpenAI is not configured", async () => {
    mockAuth({ user: null });
    delete process.env.OPENAI_API_KEY;

    const response = await POST(chatRequest());

    expect(response.status).toBe(401);
  });

  it("calls OpenAI and returns the reply for a signed-in user", async () => {
    mockAuth({ user: { id: "user-1" } });

    const response = await POST(chatRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reply: "Hello there",
    });
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
  });
});
