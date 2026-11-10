/**
 * @jest-environment node
 */

import { POST as pause } from "./pause/route";
import { POST as resume } from "./resume/route";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";

jest.mock("@/lib/meetings/route-access", () => ({
  authorizeMeetingRequest: jest.fn(),
}));

const meetingId = "11111111-1111-4111-8111-111111111111";

const buildRequest = () =>
  new Request("http://localhost/api/voice-agent", {
    method: "POST",
    body: JSON.stringify({ meetingId }),
  });

const mockWorkerResponse = (body: unknown, status: number) => {
  (global.fetch as jest.Mock).mockResolvedValue(
    new Response(JSON.stringify(body), { status })
  );
};

describe.each([
  ["resume", resume],
  ["pause", pause],
])("POST /api/voice-agent/%s", (path, handler) => {
  const originalFetch = global.fetch;
  const originalWorkerUrl = process.env.SCREEN_VISION_WORKER_URL;
  const originalWorkerSecret = process.env.SCREEN_VISION_WORKER_SECRET;

  beforeEach(() => {
    process.env.SCREEN_VISION_WORKER_URL = "http://worker.test/";
    process.env.SCREEN_VISION_WORKER_SECRET = "fixture";
    global.fetch = jest.fn();
    jest
      .mocked(authorizeMeetingRequest)
      .mockResolvedValue({ meeting: { id: meetingId } } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.SCREEN_VISION_WORKER_URL = originalWorkerUrl;
    process.env.SCREEN_VISION_WORKER_SECRET = originalWorkerSecret;
  });

  it("calls the matching worker endpoint with the meeting id", async () => {
    mockWorkerResponse({ ok: true, paused: path === "pause" }, 200);

    const response = await handler(buildRequest());

    expect(global.fetch).toHaveBeenCalledWith(
      `http://worker.test/session/${path}`,
      expect.objectContaining({ body: JSON.stringify({ meetingId }) })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([
    [402, { error: "session not found" }],
    [404, { error: "realtime client not found" }],
    [500, { error: "internal" }],
  ])("reports a worker %i as a failure without leaking it", async (status, body) => {
    mockWorkerResponse(body, status);

    const response = await handler(buildRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Worker operation failed",
    });
  });

  it.each([
    ["a 503", 503],
    ["an older worker's 200", 200],
  ])("reports waiting for captions from %s as not started", async (_label, status) => {
    mockWorkerResponse({ ok: false, waitingForCaptions: true }, status);

    const response = await handler(buildRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      waitingForCaptions: true,
    });
  });

  it("does not treat a 200 without ok: true as confirmation", async () => {
    mockWorkerResponse({}, 200);

    const response = await handler(buildRequest());

    expect(response.status).toBe(502);
  });

  it("fails without calling the worker when its URL is not set", async () => {
    delete process.env.SCREEN_VISION_WORKER_URL;

    const response = await handler(buildRequest());

    expect(response.status).toBe(502);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
