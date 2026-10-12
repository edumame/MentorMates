import { logAgentEvent } from "./logging";

describe("logAgentEvent", () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  function lastLoggedPayload(spy: jest.SpyInstance): Record<string, unknown> {
    const calls = spy.mock.calls;
    if (calls.length === 0) throw new Error("no log call");
    return JSON.parse(calls[calls.length - 1][0]);
  }

  it("emits a JSON line to console.error by default", () => {
    logAgentEvent("thing_failed");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = lastLoggedPayload(errorSpy);
    expect(payload.event).toBe("thing_failed");
    expect(payload.level).toBe("error");
    expect(typeof payload.timestamp).toBe("string");
  });

  it("includes context fields verbatim", () => {
    logAgentEvent("submit_failed", {
      eventRef: "arancornell",
      userId: "user-1",
      keyId: "mm_sk_abc",
      status: 400,
    });
    const payload = lastLoggedPayload(errorSpy);
    expect(payload).toMatchObject({
      eventRef: "arancornell",
      userId: "user-1",
      keyId: "mm_sk_abc",
      status: 400,
    });
  });

  it("serializes Error objects with message + stack + name", () => {
    const err = new TypeError("bad shape");
    logAgentEvent("boom", {}, err);
    const payload = lastLoggedPayload(errorSpy);
    expect(payload.error_message).toBe("bad shape");
    expect(payload.error_name).toBe("TypeError");
    expect(typeof payload.error_stack).toBe("string");
  });

  it("stringifies non-Error values (string, number, null)", () => {
    logAgentEvent("boom", {}, "literal string error");
    const p1 = lastLoggedPayload(errorSpy);
    expect(p1.error_message).toBe("literal string error");
    expect(p1.error_stack).toBeUndefined();

    logAgentEvent("boom", {}, 42);
    const p2 = lastLoggedPayload(errorSpy);
    expect(p2.error_message).toBe("42");
  });

  it("info level goes to console.log", () => {
    logAgentEvent("thing_ok", {}, undefined, "info");
    expect(logSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("warn level goes to console.warn", () => {
    logAgentEvent("thing_degraded", {}, undefined, "warn");
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("does not leak error fields when no error passed", () => {
    logAgentEvent("plain_event");
    const payload = lastLoggedPayload(errorSpy);
    expect(payload).not.toHaveProperty("error_message");
    expect(payload).not.toHaveProperty("error_stack");
  });

  it("output is always valid JSON (no undefined values sneaking in)", () => {
    logAgentEvent("plain_event", { userId: undefined, keyId: "k-1" });
    const raw = (errorSpy.mock.calls[0][0]) as string;
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
