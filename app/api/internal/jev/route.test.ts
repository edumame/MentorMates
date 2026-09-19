/** @jest-environment jsdom */

import { GET, POST } from "./route";
import { authenticateAgentRequest } from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    headers: Map<string, string>;
    private readonly body: unknown;
    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
      this.headers = new Map(Object.entries((init?.headers as Record<string, string>) ?? {}));
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

jest.mock("@/lib/agent/auth", () => ({ authenticateAgentRequest: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

type Row = Record<string, unknown>;

/** Minimal fake of the two tables + rpc the route touches. */
function fakeSupabase(opts: { invite: Row | null; usage: Row[] }) {
  const inserted: Row[] = [];
  const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const from = jest.fn((table: string) => {
    if (table === "internal_invites") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: opts.invite, error: null }) }),
        }),
      };
    }
    if (table === "internal_api_usage") {
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({ limit: async () => ({ data: opts.usage, error: null }) }),
            }),
          }),
        }),
        insert: async (row: Row) => {
          inserted.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from, rpc }, inserted, rpc };
}

function req(opts: { method?: string; invite?: string; body?: unknown; auth?: string }) {
  const url = "https://www.mentormates.ai/api/internal/jev";
  const headers = new Headers();
  if (opts.invite) headers.set("x-invite-code", opts.invite);
  if (opts.auth) headers.set("authorization", opts.auth);
  return {
    method: opts.method ?? "POST",
    url,
    headers,
    nextUrl: new URL(url),
    json: async () => opts.body,
  } as unknown as import("next/server").NextRequest;
}

const liveInvite = { id: "inv-1", code: "beta-2026", service: "jev", revoked_at: null, expires_at: null, max_uses: null, uses: 0 };
const authed = { userId: "user-1", eventId: "", scopes: [], keyId: "key-1" };
const upstreamJson = { model: "jev-1.13.0", answers: { verdict: { type: "noul", noul: 0.92 } }, usage: { input_tokens: 312, output_tokens: 48 } };
const goodBody = { state: "Payouts failing for 3 days", questions: { verdict: { type: "noul", instructions: "Is this urgent?" } } };

describe("/api/internal/jev", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TYPESAFE_API_KEY = "apikey_test";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => upstreamJson });
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it("GET is not discoverable: 404", async () => {
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 401) when the invite code is missing, so the route stays hidden", async () => {
    const { client } = fakeSupabase({ invite: null, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    const res = await POST(req({ body: goodBody }));
    expect(res.status).toBe(404);
    expect(authenticateAgentRequest).not.toHaveBeenCalled();
  });

  it("returns 404 for a revoked invite", async () => {
    const { client } = fakeSupabase({ invite: { ...liveInvite, revoked_at: "2026-09-18T00:00:00Z" }, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    const res = await POST(req({ invite: "beta-2026", body: goodBody }));
    expect(res.status).toBe(404);
  });

  it("passes the API key failure through once the invite is valid", async () => {
    const { client } = fakeSupabase({ invite: liveInvite, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    const { NextResponse } = jest.requireMock("next/server");
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(NextResponse.json({ error: "Invalid API key" }, { status: 401 }));
    const res = await POST(req({ invite: "beta-2026", body: goodBody }));
    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After on the sixth call inside a minute", async () => {
    const now = Date.now();
    const usage = [4, 3, 2, 1, 0].map((s) => ({ created_at: new Date(now - (50 - s) * 1000).toISOString() }));
    const { client, inserted } = fakeSupabase({ invite: liveInvite, usage });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authed);
    const res = await POST(req({ invite: "beta-2026", body: goodBody }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("rejects a bad body with 400 before calling upstream", async () => {
    const { client } = fakeSupabase({ invite: liveInvite, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authed);
    const res = await POST(req({ invite: "beta-2026", body: { state: "x" } }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("forwards to Typesafe with the pinned model and server key, logs usage, and returns the upstream JSON", async () => {
    const { client, inserted, rpc } = fakeSupabase({ invite: liveInvite, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authed);
    const res = await POST(
      req({ invite: "beta-2026", auth: "Bearer mm_sk_x", body: { model: "gpt-5.4", ...goodBody } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstreamJson);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers.Authorization).toBe("Bearer apikey_test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("jev-latest");
    expect(sent.state).toBe(goodBody.state);
    expect(sent.questions).toEqual(goodBody.questions);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ service: "jev", key_id: "key-1", invite_id: "inv-1", status: 200, prompt_tokens: 312, completion_tokens: 48 });
    expect(rpc).toHaveBeenCalledWith("increment_internal_invite_uses", { p_invite_id: "inv-1" });
  });

  it("returns 502 and still logs when upstream fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "down" }) });
    const { client, inserted } = fakeSupabase({ invite: liveInvite, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authed);
    const res = await POST(req({ invite: "beta-2026", body: goodBody }));
    expect(res.status).toBe(502);
    expect(inserted[0]).toMatchObject({ status: 503 });
  });

  it("returns 503 when the server has no upstream key configured", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const { client } = fakeSupabase({ invite: liveInvite, usage: [] });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(client);
    (authenticateAgentRequest as jest.Mock).mockResolvedValue(authed);
    const res = await POST(req({ invite: "beta-2026", body: goodBody }));
    expect(res.status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
