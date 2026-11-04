/**
 * @jest-environment node
 */
import http from "http";
import type { AddressInfo } from "net";

type Handler = (req: unknown, res: unknown, next: unknown) => unknown;

type FakeRealtimeClient = {
  realtime: {
    ws: null;
    send: jest.Mock;
    on: jest.Mock;
  };
  updateSession: jest.Mock;
  disconnect: jest.Mock;
};

const mockHarness: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any;
  handlerResults: Promise<unknown>[];
  connectOpenAi: jest.Mock;
} = {
  app: undefined,
  handlerResults: [],
  connectOpenAi: jest.fn(),
};

// Real Express, so a double send really raises ERR_HTTP_HEADERS_SENT. Express 4
// drops the promise an async handler returns, so keep it here to assert on it.
jest.mock("express", () => {
  const actual = jest.requireActual("express");
  const wrapped = (...args: unknown[]) => {
    const app = actual(...args);
    const post = app.post.bind(app);
    app.post = (path: string, handler: Handler) =>
      post(path, (req: unknown, res: unknown, next: unknown) => {
        const result = Promise.resolve(handler(req, res, next));
        result.catch(() => undefined);
        mockHarness.handlerResults.push(result);
        return result;
      });
    app.listen = jest.fn();
    mockHarness.app = app;
    return app;
  };
  return Object.assign(wrapped, actual, { __esModule: true, default: Object.assign(wrapped, actual) });
});

// cors is only installed in the worker package, not at the repo root.
jest.mock(
  "cors",
  () => ({
    __esModule: true,
    default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
  { virtual: true }
);

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

jest.mock("@stream-io/node-sdk", () => ({
  StreamClient: class {
    video = {
      call: () => ({}),
      connectOpenAi: (...args: unknown[]) => mockHarness.connectOpenAi(...args),
    };
  },
}));

function fakeRealtimeClient(): FakeRealtimeClient {
  return {
    realtime: { ws: null, send: jest.fn(), on: jest.fn() },
    updateSession: jest.fn(),
    disconnect: jest.fn(),
  };
}

function fireClose(client: FakeRealtimeClient) {
  for (const [eventName, listener] of client.realtime.on.mock.calls) {
    if (eventName === "close") listener({ error: false });
  }
}

describe("worker session lifecycle", () => {
  let server: http.Server;
  let baseUrl: string;
  const startedMeetings = new Set<string>();

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const startSession = async (meetingId: string, client: FakeRealtimeClient) => {
    mockHarness.connectOpenAi.mockResolvedValueOnce(client);

    // Captions become ready 3s after start. Run that timer straight away.
    const realSetTimeout = global.setTimeout;
    const spy = jest.spyOn(global, "setTimeout").mockImplementation(((
      callback: () => void,
      delay?: number
    ) => {
      if (delay === 3000) {
        callback();
        return 0;
      }
      return realSetTimeout(callback, delay);
    }) as typeof setTimeout);

    const response = await post("/session/start", {
      meetingId,
      callId: `call-${meetingId}`,
      agentUserId: "agent",
      instructions: "be helpful",
    });
    spy.mockRestore();

    expect(response).toEqual({ status: 200, body: { ok: true } });
    startedMeetings.add(meetingId);
  };

  beforeAll(async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await import("./index");
    server = http.createServer(mockHarness.app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    for (const meetingId of startedMeetings) {
      await post("/session/stop", { meetingId });
    }
    startedMeetings.clear();
    mockHarness.handlerResults.length = 0;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.restoreAllMocks();
  });

  describe("POST /session/resume", () => {
    it("sends one 500 and does not reject when the realtime socket is gone", async () => {
      const client = fakeRealtimeClient();
      client.realtime.send.mockImplementation(() => {
        throw new Error("RealtimeAPI is not connected");
      });
      await startSession("dead", client);
      mockHarness.handlerResults.length = 0;

      const response = await post("/session/resume", { meetingId: "dead" });

      expect(response).toEqual({ status: 500, body: { error: "internal" } });
      expect(mockHarness.handlerResults).toHaveLength(1);
      // A rejection here is unhandled in production and ends the Node process.
      await expect(mockHarness.handlerResults[0]).resolves.toBeDefined();
    });

    it("keeps serving other sessions after one session fails", async () => {
      const dead = fakeRealtimeClient();
      dead.realtime.send.mockImplementation(() => {
        throw new Error("RealtimeAPI is not connected");
      });
      const live = fakeRealtimeClient();
      await startSession("dead", dead);
      await startSession("live", live);

      await post("/session/resume", { meetingId: "dead" });
      const response = await post("/session/resume", { meetingId: "live" });

      expect(response).toEqual({
        status: 200,
        body: { ok: true, paused: false },
      });
      expect(live.realtime.send).toHaveBeenCalledWith("response.create", {});
    });

    it("resumes a healthy session", async () => {
      const client = fakeRealtimeClient();
      await startSession("healthy", client);

      const response = await post("/session/resume", { meetingId: "healthy" });

      expect(response).toEqual({
        status: 200,
        body: { ok: true, paused: false },
      });
      expect(client.updateSession).toHaveBeenLastCalledWith({
        turn_detection: { type: "server_vad" },
      });
    });
  });

  describe("when the realtime socket closes", () => {
    it("removes the session and stops its poll loop", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      const client = fakeRealtimeClient();
      await startSession("closed", client);

      fireClose(client);

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      clearIntervalSpy.mockRestore();
      const response = await post("/session/resume", { meetingId: "closed" });
      expect(response).toEqual({
        status: 402,
        body: { error: "session not found" },
      });
      expect(client.realtime.send).not.toHaveBeenCalled();
    });

    it("does not remove a newer session for the same meeting", async () => {
      const replaced = fakeRealtimeClient();
      const current = fakeRealtimeClient();
      await startSession("restarted", replaced);
      await startSession("restarted", current);

      fireClose(replaced);

      const response = await post("/session/resume", {
        meetingId: "restarted",
      });
      expect(response).toEqual({
        status: 200,
        body: { ok: true, paused: false },
      });
      expect(current.realtime.send).toHaveBeenCalledWith("response.create", {});
    });
  });
});
