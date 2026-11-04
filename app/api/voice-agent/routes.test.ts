/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST as pause } from "./pause/route";
import { POST as resume } from "./resume/route";
import { GET as captions } from "./captions/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const id = "123e4567-e89b-42d3-a456-426614174000";
const fetchMock = jest.fn();
let currentUser: string | null;

const postTo = (route: typeof pause, body: unknown = { meetingId: id }) =>
  route(new NextRequest("http://localhost/api/voice-agent", { method: "POST", body: JSON.stringify(body) }));
const getCaptions = (query = `?meetingId=${id}`) =>
  captions(new NextRequest(`http://localhost/api/voice-agent/captions${query}`));

const callers: Array<[string, (query?: boolean) => Promise<Response>, string]> = [
  ["pause", (valid = true) => postTo(pause, valid ? undefined : { meetingId: "nope" }), "/session/pause"],
  ["resume", (valid = true) => postTo(resume, valid ? undefined : { meetingId: "nope" }), "/session/resume"],
  ["captions", (valid = true) => getCaptions(valid ? undefined : "?meetingId=nope"), `/captions/stream?meetingId=${id}`],
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  process.env.SCREEN_VISION_WORKER_URL = "http://worker.test/";
  process.env.SCREEN_VISION_WORKER_SECRET = "test-worker-secret";
  currentUser = "owner";
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUser ? { id: currentUser } : null }, error: null })) },
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: { id, user_id: "owner", event_id: null }, error: null })),
    })),
  });
});

describe.each(callers)("voice-agent %s", (_name, call, workerPath) => {
  it("rejects anonymous callers without reaching the worker", async () => {
    currentUser = null;
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects users who cannot view the meeting", async () => {
    currentUser = "stranger";
    expect((await call()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed meeting id", async () => {
    expect((await call(false)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the worker secret for the meeting owner", async () => {
    expect((await call()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://worker.test${workerPath}`);
    expect(init.headers["x-worker-secret"]).toBe("test-worker-secret");
  });

  it("reports a missing worker URL", async () => {
    delete process.env.SCREEN_VISION_WORKER_URL;
    expect((await call()).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("voice-agent captions proxy", () => {
  it("streams the worker's events through", async () => {
    fetchMock.mockResolvedValue(new Response('data: {"text":"hi"}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));
    const res = await getCaptions();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await expect(res.text()).resolves.toBe('data: {"text":"hi"}\n\n');
  });

  it("stops the upstream stream when the viewer disconnects", async () => {
    const controller = new AbortController();
    await captions(new NextRequest(`http://localhost/api/voice-agent/captions?meetingId=${id}`, {
      signal: controller.signal,
    }));
    controller.abort();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("does not expose a worker failure as a stream", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    const res = await getCaptions();
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("nope");
  });

  it("answers 502 when the worker is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));
    expect((await getCaptions()).status).toBe(502);
  });
});
