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

type ContextRow = { summary?: string; updated_at: string; last_frame_ts?: string };

let currentUser: string | null;
let row: ContextRow | null;
let failClaim: boolean;

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = "owner";
  row = null;
  failClaim = false;
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
      // meeting_screen_context: model the INSERT .. ON CONFLICT DO NOTHING and
      // the UPDATE .. WHERE updated_at < cutoff that the frame claim relies on.
      return {
        upsert: jest.fn((value: ContextRow) => ({
          select: jest.fn(async () => {
            if (failClaim) return { data: null, error: { message: "database failure" } };
            if (row) return { data: [], error: null };
            row = { ...value };
            return { data: [{ meeting_id: id }], error: null };
          }),
        })),
        update: jest.fn((patch: Partial<ContextRow>) => {
          let cutoff: string | undefined;
          const builder: Record<string, unknown> = {
            eq: jest.fn(() => builder),
            lt: jest.fn((_column: string, value: string) => { cutoff = value; return builder; }),
            select: jest.fn(async () => {
              if (cutoff && row && row.updated_at >= cutoff) return { data: [], error: null };
              Object.assign(row!, patch);
              return { data: [{ meeting_id: id }], error: null };
            }),
            then: (resolve: (value: { error: null }) => void) => {
              Object.assign(row!, patch);
              resolve({ error: null });
            },
          };
          return builder;
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
    expect(row).toBeNull();
  });

  it("rejects a signed-in user who cannot access the meeting", async () => {
    currentUser = "stranger";
    expect((await POST(request())).status).toBe(403);
    expect(mockCreateResponse).not.toHaveBeenCalled();
    expect(row).toBeNull();
  });

  it("stores the summary for the owner, with a frame larger than the ID-only cap", async () => {
    const response = await POST(request({ meetingId: id, ts, imageBase64: "a".repeat(500_000) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, summary: "[Screen] Login form" });
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ summary: "[Screen] Login form", last_frame_ts: new Date(ts).toISOString() });
  });

  it("rejects a body over the frame cap", async () => {
    const response = await POST(request({ meetingId: id, ts, imageBase64: "a".repeat(5 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });

  it.each([
    [{ meetingId: id, ts }],
    [{ meetingId: id, ts, imageBase64: "" }],
    [{ meetingId: id, ts, imageBase64: 7 }],
    [{ meetingId: id, imageBase64: "aGVsbG8=" }],
    [{ meetingId: id, ts: "soon", imageBase64: "aGVsbG8=" }],
    [{ meetingId: id, ts: 1e20, imageBase64: "aGVsbG8=" }],
  ])("rejects an invalid frame before calling OpenAI: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });

  it("returns 429 without calling OpenAI when a frame arrives too soon", async () => {
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(429);
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
  });

  it("accepts the next frame once the window has passed", async () => {
    row = { summary: "[Screen] Old", updated_at: new Date(Date.now() - 60_000).toISOString() };
    expect((await POST(request())).status).toBe(200);
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(row?.summary).toBe("[Screen] Login form");
  });

  it("does not let a slow OpenAI call push out the next frame's window", async () => {
    let claimedAt: string | undefined;
    mockCreateResponse.mockImplementation(async () => {
      claimedAt = row?.updated_at;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { output_text: "Login form" };
    });
    expect((await POST(request())).status).toBe(200);
    expect(claimedAt).toBeDefined();
    expect(row?.updated_at).toBe(claimedAt);
  });

  it("does not call OpenAI when the claim fails", async () => {
    failClaim = true;
    expect((await POST(request())).status).toBe(500);
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });
});
