/** @jest-environment node */
import { TinyFishClient } from "./client";
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
it.each(["oversized", "complete"])("cancels and releases the %s stream", async mode => {
  const cancel = jest.fn();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(mode === "oversized" ? "x".repeat(2 * 1024 * 1024 + 1) : 'data: {"type":"COMPLETE","resultJson":{"parsed":{"name":"ok"}}}\n\n')); }, cancel });
  global.fetch = jest.fn().mockResolvedValue(new Response(body));
  const promise = new TinyFishClient({ apiKey: "test" }).runAutomation({ url: "https://devpost.com", goal: "test" });
  if (mode === "oversized") await expect(promise).rejects.toThrow("size limit");
  else await expect(promise).resolves.toMatchObject({ success: true, data: { name: "ok" } });
  expect(cancel).toHaveBeenCalledTimes(1); expect(body.locked).toBe(false);
});
it("cancels upstream error bodies without exposing their text", async () => {
  const cancel = jest.fn();
  global.fetch = jest.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 500 }));
  await expect(new TinyFishClient({ apiKey: "test" }).runAutomation({ url: "https://devpost.com", goal: "test" })).rejects.toThrow("TinyFish request failed");
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("aborts the provider fetch at the configured deadline", async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const assertion = expect(new TinyFishClient({ apiKey: "test", timeoutMs: 100 }).runAutomation({ url: "https://devpost.com", goal: "test" })).rejects.toThrow("aborted");
  await jest.advanceTimersByTimeAsync(100); await assertion;
  jest.useRealTimers();
});
