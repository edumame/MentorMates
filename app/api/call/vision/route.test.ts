/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const mockCreateResponse = jest.fn();

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("openai", () => ({
  OpenAI: jest.fn(() => ({ responses: { create: mockCreateResponse } })),
}));

const id = "123e4567-e89b-42d3-a456-426614174000";
const ts = 1_790_000_000_000;
const request = (body: unknown = { meetingId: id, ts, imageBase64: "aGVsbG8=" }) =>
  new NextRequest("http://localhost/api/call/vision", { method: "POST", body: JSON.stringify(body) });

let currentUser: string | null;
let upserts: Array<Record<string, unknown>>;

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = "owner";
  upserts = [];
  mockCreateResponse.mockResolvedValue({ output_text: "Login form" });
  jest.spyOn(console, "error").mockImplementation(() => {});
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUser ? { id: currentUser } : null }, error: null })) },
    rpc: jest.fn(async () => ({ data: false, error: null })),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "meetings") {
        const builder: Record<string, jest.Mock> = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          maybeSingle: jest.fn(async () => ({ data: { id, user_id: "owner", event_id: null }, error: null })),
        };
        return builder;
      }
      return {
        upsert: jest.fn(async (value: Record<string, unknown>) => {
          upserts.push(value);
          return { error: null };
        }),
      };
    }),
  });
});

afterEach(() => jest.restoreAllMocks());

describe("POST /api/call/vision", () => {
  it("rejects a logged-out caller before spending or writing anything", async () => {
    currentUser = null;
    expect((await POST(request())).status).toBe(401);
    expect(mockCreateResponse).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("rejects a signed-in user who cannot access the meeting", async () => {
    currentUser = "stranger";
    expect((await POST(request())).status).toBe(403);
    expect(mockCreateResponse).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("stores the summary for the owner, with a frame larger than the ID-only cap", async () => {
    const response = await POST(request({ meetingId: id, ts, imageBase64: "a".repeat(500_000) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, summary: "[Screen] Login form" });
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(upserts[0]).toMatchObject({
      meeting_id: id,
      summary: "[Screen] Login form",
      last_frame_ts: new Date(ts).toISOString(),
    });
  });

  it("rejects a body over the frame cap", async () => {
    const response = await POST(request({ meetingId: id, ts, imageBase64: "a".repeat(3 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });

  it.each([
    [{ meetingId: id, ts }],
    [{ meetingId: id, ts, imageBase64: "" }],
    [{ meetingId: id, ts, imageBase64: 7 }],
    [{ meetingId: id, imageBase64: "aGVsbG8=" }],
    [{ meetingId: id, ts: "soon", imageBase64: "aGVsbG8=" }],
  ])("rejects an invalid frame before calling OpenAI: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });
});
