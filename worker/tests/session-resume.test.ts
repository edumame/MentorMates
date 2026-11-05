/**
 * @jest-environment node
 */

// Lives outside worker/src so the worker's `tsc` build, which has no Jest types, skips it.

import http from "http";
import type { AddressInfo } from "net";
import express from "express";

const mockRealtimeClient = {
  realtime: { send: jest.fn(), on: jest.fn() },
  updateSession: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};
const mockMaybeSingle = jest.fn();

jest.mock("cors", () => () => (_req: unknown, _res: unknown, next: () => void) => next(), {
  virtual: true,
});

jest.mock("@stream-io/openai-realtime-api", () => ({}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
    }),
  }),
}));

jest.mock("@stream-io/node-sdk", () => ({
  StreamClient: class {
    video = {
      call: () => ({}),
      connectOpenAi: async () => mockRealtimeClient,
    };
  },
}));

describe("worker POST /session/resume", () => {
  let server: http.Server;
  let meetingId: string;
  let meetingCount = 0;
  let baseUrl: string;
  let finishCaptionDelay: () => void;
  let runPoll: () => Promise<void>;

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const lastPolledTurnDetection = async () => {
    mockRealtimeClient.updateSession.mockClear();
    mockMaybeSingle.mockResolvedValue({
      data: { summary: `screen ${Math.random()}`, updated_at: new Date().toISOString() },
      error: null,
    });
    await runPoll();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    return mockRealtimeClient.updateSession.mock.calls.at(-1)?.[0].turn_detection;
  };

  beforeAll(async () => {
    // The worker starts listening on import, so capture its app instead of binding its port.
    const listen = jest
      .spyOn(express.application, "listen")
      .mockReturnValue({} as http.Server);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await import("../src/index");

    server = http.createServer(listen.mock.contexts[0] as http.RequestListener);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRealtimeClient.realtime.send.mockReset();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Hold the 3s caption delay and the 2s poll so each test decides when they run.
    const realSetTimeout = global.setTimeout;
    const realSetInterval = global.setInterval;
    const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((
      callback: () => void,
      ms?: number
    ) => {
      if (ms === 3000) {
        finishCaptionDelay = callback;
        return 0;
      }
      return realSetTimeout(callback, ms);
    }) as never);
    const intervalSpy = jest.spyOn(global, "setInterval").mockImplementation(((
      callback: () => Promise<void>,
      ms?: number
    ) => {
      if (ms === 2000) {
        runPoll = callback;
        return 0;
      }
      return realSetInterval(callback, ms);
    }) as never);

    // captionReady is never cleared, so each test needs its own meeting id.
    meetingId = `meeting-${++meetingCount}`;
    const started = await post("/session/start", {
      meetingId,
      callId: "call-1",
      agentUserId: "agent-1",
      instructions: "help",
    });
    expect(started.status).toBe(200);
    timeoutSpy.mockRestore();
    intervalSpy.mockRestore();
  });

  it("returns 402 when the session does not exist", async () => {
    const result = await post("/session/resume", { meetingId: "missing" });

    expect(result).toEqual({ status: 402, body: { error: "session not found" } });
  });

  it("rejects a resume before captions are ready and stays paused", async () => {
    const result = await post("/session/resume", { meetingId });

    expect(result).toEqual({
      status: 503,
      body: { ok: false, waitingForCaptions: true },
    });
    expect(mockRealtimeClient.realtime.send).not.toHaveBeenCalled();
    expect(await lastPolledTurnDetection()).toBeNull();
  });

  it("resumes once captions are ready and keeps VAD on across polls", async () => {
    finishCaptionDelay();

    const result = await post("/session/resume", { meetingId });

    expect(result).toEqual({ status: 200, body: { ok: true, paused: false } });
    expect(mockRealtimeClient.realtime.send.mock.calls.map(([type]) => type)).toEqual([
      "input_audio_buffer.commit",
      "response.create",
      "input_audio_buffer.clear",
    ]);
    expect(mockRealtimeClient.updateSession).toHaveBeenCalledWith({
      turn_detection: { type: "server_vad" },
    });
    expect(await lastPolledTurnDetection()).toEqual({ type: "server_vad" });
  });

  it("answers 500 once and stays paused when the realtime send fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    finishCaptionDelay();
    mockRealtimeClient.realtime.send.mockImplementation(() => {
      throw new Error("socket closed");
    });

    const result = await post("/session/resume", { meetingId });

    expect(result).toEqual({ status: 500, body: { error: "internal" } });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(await lastPolledTurnDetection()).toBeNull();
  });
});
