/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST as pause } from "./pause/route";
import { POST as resume } from "./resume/route";

const meetingId = "meeting-1";

const buildRequest = (path: string) =>
  new NextRequest(`http://localhost/api/voice-agent/${path}`, {
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

  beforeEach(() => {
    process.env.SCREEN_VISION_WORKER_URL = "http://worker.test/";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.SCREEN_VISION_WORKER_URL = originalWorkerUrl;
  });

  it("calls the matching worker endpoint with the meeting id", async () => {
    mockWorkerResponse({ ok: true }, 200);

    const response = await handler(buildRequest(path));

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
    [503, { ok: false, waitingForCaptions: true }],
  ])("forwards a worker %i instead of masking it as 200", async (status, body) => {
    mockWorkerResponse(body, status);

    const response = await handler(buildRequest(path));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns 500 without calling the worker when its URL is not set", async () => {
    delete process.env.SCREEN_VISION_WORKER_URL;

    const response = await handler(buildRequest(path));

    expect(response.status).toBe(500);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
