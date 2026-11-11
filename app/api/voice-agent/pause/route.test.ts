/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST as pause } from "./route";
import { POST as resume } from "../resume/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const id = "123e4567-e89b-42d3-a456-426614174000";
const request = (body: unknown = { meetingId: id }) =>
  new NextRequest("http://localhost/api/voice-agent", { method: "POST", body: JSON.stringify(body) });

let currentUser: string | null;
let meetingLookupFails: boolean;
const workerFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = "owner";
  meetingLookupFails = false;
  process.env.SCREEN_VISION_WORKER_URL = "http://worker.test/";
  process.env.SCREEN_VISION_WORKER_SECRET = "worker-secret";
  workerFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  global.fetch = workerFetch as unknown as typeof fetch;
  jest.spyOn(console, "error").mockImplementation(() => {});
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUser ? { id: currentUser } : null }, error: null })) },
    rpc: jest.fn(async () => ({ data: false, error: null })),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => {
      const builder: Record<string, jest.Mock> = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        maybeSingle: jest.fn(async () => meetingLookupFails
          ? { data: null, error: { message: "database failure" } }
          : { data: { id, user_id: "owner", event_id: null }, error: null }),
      };
      return builder;
    }),
  });
});

afterEach(() => jest.restoreAllMocks());

describe.each([["pause", pause], ["resume", resume]] as const)("voice-agent %s", (action, handler) => {
  it("rejects a logged-out caller without reaching the worker", async () => {
    currentUser = null;
    expect((await handler(request())).status).toBe(401);
    expect(workerFetch).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who cannot access the meeting", async () => {
    currentUser = "stranger";
    expect((await handler(request())).status).toBe(403);
    expect(workerFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid meeting id", async () => {
    expect((await handler(request({ meetingId: "x" }))).status).toBe(400);
    expect(workerFetch).not.toHaveBeenCalled();
  });

  it("fails closed when the meeting lookup fails", async () => {
    meetingLookupFails = true;
    expect((await handler(request())).status).toBe(502);
    expect(workerFetch).not.toHaveBeenCalled();
  });

  it("forwards the owner's request to the worker", async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(workerFetch).toHaveBeenCalledWith(
      `http://worker.test/session/${action}`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ meetingId: id }),
        headers: expect.objectContaining({ Authorization: "Bearer worker-secret" }),
      })
    );
  });

  it("reports a worker failure", async () => {
    workerFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect((await handler(request())).status).toBe(502);
  });
});
