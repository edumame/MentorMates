/** @jest-environment node */
import { POST as proxy } from "./route";
import { POST as direct } from "@/app/api/scrape/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { scrapeEvent } from "@/lib/scraper/devpost";
jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/scraper/devpost", () => ({ scrapeEvent: jest.fn() }));
const getUser = jest.fn();
const rpc = jest.fn();
const fetchMock = jest.fn();
const oldFetch = global.fetch;
const oldEnv = { ...process.env };
const call = (route: typeof proxy | typeof direct, body: unknown = { url: "https://event.devpost.com/" }) => route(new Request("http://localhost/api/scrape", { method: "POST", body: JSON.stringify(body) }) as Parameters<typeof proxy>[0]);
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null });
  jest.mocked(createSupabaseClient).mockResolvedValue({ auth: { getUser } } as never);
  jest.mocked(createSupabaseServiceClient).mockReturnValue({ rpc } as never);
  rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
  process.env.TINYFISH_API_KEY = "test";
  process.env.EVENT_SCRAPER_API_URL = "https://scraper.example.org";
  process.env.EVENT_SCRAPER_API_TOKEN = "server-token";
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { event_name: "Event", tracks: [{ name: "Track", scoring_criteria: [{ name: "Quality" }] }, null] }, runId: "run" })));
  jest.mocked(scrapeEvent).mockResolvedValue({ success: true, data: { event_name: "Event" }, raw: "private debug" });
});
afterAll(() => { global.fetch = oldFetch; process.env = oldEnv; });
describe.each([["direct", direct], ["proxy", proxy]] as const)("%s admission", (_, route) => {
  it("requires verified authentication before quota or paid work", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await call(route)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled(); expect(scrapeEvent).not.toHaveBeenCalled();
  });
  it("rejects failed session verification even when a user is returned", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "unverified" } }, error: new Error("expired") });
    expect((await call(route)).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects oversized incoming payload before quota", async () => {
    expect((await call(route, { url: "x".repeat(9000) })).status).toBe(413); expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid payload before quota", async () => {
    expect((await call(route, { url: "http://127.0.0.1" })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("fails closed when migration is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "missing" } });
    expect((await call(route)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled(); expect(scrapeEvent).not.toHaveBeenCalled();
  });
  it("shares the quota and returns Retry-After", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 90 }], error: null });
    const result = await call(route);
    expect(result.status).toBe(429); expect(result.headers.get("Retry-After")).toBe("90");
    expect(rpc).toHaveBeenCalledWith("reserve_scraper_request", { p_user_id: "verified" });
    expect(fetchMock).not.toHaveBeenCalled(); expect(scrapeEvent).not.toHaveBeenCalled();
  });
  it("preserves successful response shape", async () => {
    const result = await call(route); expect(result.status).toBe(200);
    const body = await result.json(); expect(body.import?.event_name ?? body.data.event_name).toBe("Event"); expect(body.rawPreview).toBeUndefined();
  });
});
it("requires configured remote token before quota", async () => {
  delete process.env.EVENT_SCRAPER_API_TOKEN;
  expect((await call(proxy)).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
});
it("sends server token only to configured proxy and forbids redirects", async () => {
  await call(proxy);
  expect(fetchMock).toHaveBeenCalledWith("https://scraper.example.org/api/scrape", expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal), headers: expect.objectContaining({ Authorization: "Bearer server-token" }) }));
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
});
it("sanitizes provider failures", async () => {
  jest.mocked(scrapeEvent).mockResolvedValue({ success: false, data: null, raw: "secret", error: "secret" });
  fetchMock.mockRejectedValue(new Error("secret-token"));
  for (const route of [direct, proxy]) { const result = await call(route); expect(result.status).toBe(502); expect(JSON.stringify(await result.json())).not.toContain("secret"); }
});
it("bounds proxy responses", async () => {
  fetchMock.mockResolvedValue(new Response("x".repeat(2 * 1024 * 1024 + 1)));
  expect((await call(proxy)).status).toBe(502);
});

it.each(["not-json", "null", '{"success":false,"error":"private"}'])("maps invalid upstream JSON/body to502: %s", async raw => {
  fetchMock.mockResolvedValue(new Response(raw));
  const result = await call(proxy); expect(result.status).toBe(502);
  expect(JSON.stringify(await result.json())).not.toContain("private");
});
it("retains attempted quota on upstream failure", async () => {
  fetchMock.mockRejectedValue(new Error("timeout"));
  expect((await call(proxy)).status).toBe(502);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("requires direct provider config before quota", async () => {
  delete process.env.TINYFISH_API_KEY;
  expect((await call(direct)).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
});
