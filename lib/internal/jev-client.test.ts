import { askJev, describeError, extractAnswer } from "./jev-client";

describe("extractAnswer", () => {
  it("pulls the assistant text out of an OpenAI-style completion", () => {
    expect(extractAnswer({ choices: [{ message: { role: "assistant", content: "true" } }] })).toBe("true");
  });
  it("returns an empty string when the shape is unexpected", () => {
    expect(extractAnswer({})).toBe("");
    expect(extractAnswer(null)).toBe("");
  });
});

describe("describeError", () => {
  it("explains a bad API key", () => {
    expect(describeError(401, { error: "Invalid API key" })).toMatch(/API key/);
  });
  it("explains a dead invite without revealing the route exists", () => {
    expect(describeError(404, { error: "Not found" })).toMatch(/invite/i);
  });
  it("turns a 429 into a wait with the Retry-After seconds", () => {
    expect(describeError(429, { error: "Rate limit" }, "17")).toBe("Rate limit reached (5 calls a minute). Try again in 17 seconds.");
  });
  it("passes through the server's message for 400 and 503", () => {
    expect(describeError(400, { error: "messages[] is required" })).toBe("messages[] is required");
    expect(describeError(503, { error: "Jev is not configured on this server yet" })).toBe("Jev is not configured on this server yet");
  });
});

describe("askJev", () => {
  const ok = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
    jest.fn().mockResolvedValue({
      ok: status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
      json: async () => body,
    });

  it("posts the question with the invite and key, and returns answer, remaining and latency", async () => {
    const fetchFn = ok({ choices: [{ message: { content: "false" } }] }, { "x-ratelimit-remaining": "3" });
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", question: "Is the sky green?" });
    expect(res).toMatchObject({ ok: true, answer: "false", remaining: 3, status: 200 });
    expect(typeof res.latencyMs).toBe("number");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/internal/jev?invite=beta");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer mm_sk_abc");
    expect(JSON.parse(init.body)).toEqual({ messages: [{ role: "user", content: "Is the sky green?" }] });
  });

  it("returns a friendly error and the retry hint on 429", async () => {
    const fetchFn = ok({ error: "Rate limit" }, { "retry-after": "9" }, 429);
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", question: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/9 seconds/);
    expect(res.status).toBe(429);
  });

  it("reports a network failure without throwing", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("offline"));
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", question: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/offline|network/i);
  });
});
