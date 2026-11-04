/** @jest-environment node */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const SECRET = "test-worker-secret";
const connectOpenAi = jest.fn();

// The worker's own dependencies are not installed at the repo root.
jest.mock("cors", () => () => (_req: unknown, _res: unknown, next: () => void) => next(), { virtual: true });
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => ({})) }), { virtual: true });
jest.mock("@stream-io/node-sdk", () => ({
  StreamClient: jest.fn(() => ({
    video: { call: jest.fn(() => ({})), connectOpenAi: (...args: unknown[]) => connectOpenAi(...args) },
  })),
}), { virtual: true });

let server: Server;
let baseUrl: string;

const post = (path: string, body: unknown, secret?: string) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret === undefined ? {} : { "x-worker-secret": secret }),
    },
    body: JSON.stringify(body),
  });

const sessionPaths = ["/session/start", "/session/stop", "/session/pause", "/session/resume"];
const startBody = { meetingId: "m1", callId: "m1", agentUserId: "agent", instructions: "attacker prompt" };

beforeAll(async () => {
  process.env.PORT = "0";
  process.env.SCREEN_VISION_WORKER_SECRET = SECRET;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  server = require("./index").server;
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  process.env.SCREEN_VISION_WORKER_SECRET = SECRET;
  connectOpenAi.mockReset();
  connectOpenAi.mockRejectedValue(new Error("stop after connect"));
});

describe("worker authentication", () => {
  it("keeps /health open for the platform health check", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  it.each(sessionPaths)("rejects %s without the shared secret", async (path) => {
    const res = await post(path, startBody);
    expect(res.status).toBe(401);
    expect(connectOpenAi).not.toHaveBeenCalled();
  });

  it.each(sessionPaths)("rejects %s with a wrong secret", async (path) => {
    const res = await post(path, startBody, "not-the-secret");
    expect(res.status).toBe(401);
    expect(connectOpenAi).not.toHaveBeenCalled();
  });

  it("does not parse the body of an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/session/stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(401);
  });

  it("rejects /captions/stream without the shared secret", async () => {
    const res = await fetch(`${baseUrl}/captions/stream?meetingId=m1`);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).not.toContain("text/event-stream");
  });

  it.each(["", undefined])("fails closed when the worker secret is %p", async (configured) => {
    if (configured === undefined) delete process.env.SCREEN_VISION_WORKER_SECRET;
    else process.env.SCREEN_VISION_WORKER_SECRET = configured;

    for (const secret of [undefined, "", SECRET]) {
      const res = await post("/session/start", startBody, secret);
      expect(res.status).toBe(503);
    }
    expect(connectOpenAi).not.toHaveBeenCalled();
  });

  it("lets the server start a session with the shared secret", async () => {
    // /session/start arms a 3s caption timer that must not hold the test process open.
    const realSetTimeout = global.setTimeout;
    jest.spyOn(global, "setTimeout").mockImplementation(
      ((...args: Parameters<typeof setTimeout>) => realSetTimeout(...args).unref()) as typeof setTimeout
    );
    const res = await post("/session/start", startBody, SECRET);
    expect(connectOpenAi).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(500); // the mocked connect rejects after the auth gate
    (global.setTimeout as unknown as jest.Mock).mockRestore();
  });

  it("lets the server stop a session with the shared secret", async () => {
    const res = await post("/session/stop", { meetingId: "missing" }, SECRET);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("opens the caption stream immediately for the server, before any caption exists", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/captions/stream?meetingId=m1`, {
      headers: { "x-worker-secret": SECRET },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
  });
});
