/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("openai", () => jest.fn());

describe("POST /api/events/ai-chat/parse-file (PUB-015)", () => {
  const original = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    jest.mocked(createSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    } as never);
  });
  afterAll(() => {
    process.env.OPENAI_API_KEY = original;
  });

  it("returns 400 (not 500) for a non-multipart body", async () => {
    const req = new NextRequest("http://localhost/api/events/ai-chat/parse-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 when the file field is not a file", async () => {
    const form = new FormData();
    form.append("file", "text");
    const req = new NextRequest("http://localhost/api/events/ai-chat/parse-file", { method: "POST", body: form });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 401 for signed-out callers", async () => {
    jest.mocked(createSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);
    const req = new NextRequest("http://localhost/api/events/ai-chat/parse-file", { method: "POST", body: "x" });
    expect((await POST(req)).status).toBe(401);
  });
});
