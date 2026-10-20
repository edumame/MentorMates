/** @jest-environment node */
import { parseScraperRequest, readBoundedJson, reserveScraperQuota, scraperProxyConfig } from "./request";

describe("scraper admission", () => {
  it.each(["https://devpost.com", "https://event.devpost.com/path#fragment"])("allows Devpost: %s", url => {
    expect(parseScraperRequest({ url })).toEqual({ url: new URL(url).origin + new URL(url).pathname, browserProfile: "lite" });
  });
  it.each([null, [], {}, { url: "https://devpost.com", browserProfile: "expensive" }, { url: "https://devpost.com", userId: "spoof" }, { url: "x".repeat(2049) }])("rejects malformed payload %j", payload => {
    expect(() => parseScraperRequest(payload)).toThrow();
  });
  it.each(["http://devpost.com", "file:///etc/passwd", "https://user:pass@devpost.com", "https://devpost.com:444", "https://evildevpost.com", "https://devpost.com.evil.test", "https://127.0.0.1", "https://[::1]", "https://localhost", "https://devpost.com."])("rejects unsafe or unsupported URL %s", url => {
    expect(() => parseScraperRequest({ url })).toThrow();
  });
  it("accepts exact custom hosts but not their subdomains", () => {
    expect(parseScraperRequest({ url: "https://event.example.org", browserProfile: "stealth" }, " event.example.org ").browserProfile).toBe("stealth");
    expect(() => parseScraperRequest({ url: "https://sub.event.example.org" }, "event.example.org")).toThrow();
  });
  it("requires proxy HTTPS and a server token", () => {
    expect(() => scraperProxyConfig("https://scraper.example.org", "")).toThrow();
    expect(() => scraperProxyConfig("http://scraper.example.org", "secret")).toThrow();
    expect(scraperProxyConfig("https://scraper.example.org/", "secret")).toEqual({ endpoint: "https://scraper.example.org/api/scrape", token: "secret" });
  });
});

describe("bounded JSON", () => {
  it("reads valid multibyte JSON", async () => {
    expect(await readBoundedJson(new Response('{"text":"é"}'), 20)).toEqual({ text: "é" });
  });
  it("rejects bad JSON", async () => {
    await expect(readBoundedJson(new Response("{"), 20)).rejects.toMatchObject({ status: 400 });
  });
  it("counts bytes rather than chars or declared length and cancels stream", async () => {
    const cancel = jest.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('"ééé"')); }, cancel });
    await expect(readBoundedJson({ body }, 6)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
});

describe("quota reservation", () => {
  it("uses one RPC and verified identity", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    expect(await reserveScraperQuota({ rpc }, "verified-id")).toEqual({ allowed: true, retry_after_seconds: 0 });
    expect(rpc).toHaveBeenCalledWith("reserve_scraper_request", { p_user_id: "verified-id" });
  });
  it("returns denial for route Retry-After", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 60 }], error: null });
    expect(await reserveScraperQuota({ rpc }, "verified-id")).toEqual({ allowed: false, retry_after_seconds: 60 });
  });
  it.each([{ data: null, error: new Error("missing rpc") }, { data: [], error: null }, { data: [{ allowed: false, retry_after_seconds: 0 }], error: null }])("fails closed for unusable DB result", async result => {
    await expect(reserveScraperQuota({ rpc: jest.fn().mockResolvedValue(result) }, "id")).rejects.toMatchObject({ status: 503 });
  });
  it("fails closed on connection failure", async () => {
    await expect(reserveScraperQuota({ rpc: jest.fn().mockRejectedValue(new Error("connection")) }, "id")).rejects.toMatchObject({ status: 503 });
  });
});

it("bounds stalled JSON reads and cancels without waiting for a stuck cancellation", async () => {
  jest.useFakeTimers();
  const cancel = jest.fn(() => new Promise<void>(() => {}));
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel });
  const assertion = expect(readBoundedJson({ body }, 100)).rejects.toMatchObject({ status: 408 });
  await jest.advanceTimersByTimeAsync(15_000);
  await assertion;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(body.locked).toBe(false);
  jest.useRealTimers();
});
