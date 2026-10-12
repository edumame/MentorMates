import { askJev, buildQuestion, describeError, extractAnswer } from "./jev-client";

describe("extractAnswer (Typesafe answers)", () => {
  it("renders a noul answer as yes/no with the probability", () => {
    expect(extractAnswer({ answers: { verdict: { type: "noul", noul: 0.92 } } })).toBe("Yes (92%)");
    expect(extractAnswer({ answers: { verdict: { type: "noul", noul: 0.2 } } })).toBe("No (20%)");
  });
  it("renders a choice answer with the picked option and confidence", () => {
    expect(
      extractAnswer({ answers: { dept: { type: "choice", choice: "technical", probabilities: { billing: 0.08, technical: 0.85, sales: 0.07 }, confidence: 0.82 } } })
    ).toBe("technical (85%)");
  });
  it("renders a score answer", () => {
    expect(extractAnswer({ answers: { urgency: { type: "score", score: 7.4, confidence: 0.7 } } })).toBe("7.4");
  });
  it("returns an empty string when the shape is unexpected", () => {
    expect(extractAnswer({})).toBe("");
    expect(extractAnswer(null)).toBe("");
  });
});

describe("buildQuestion", () => {
  it("builds a yes/no question", () => {
    expect(buildQuestion({ kind: "noul", instructions: "Is it urgent?", criteria: "" })).toEqual({ type: "noul", instructions: "Is it urgent?" });
  });
  it("builds a choice question from comma-separated options", () => {
    expect(buildQuestion({ kind: "choice", instructions: "Which team?", criteria: "billing, technical, sales" })).toEqual({
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: null, technical: null, sales: null },
    });
  });
  it("builds a score question from ordered levels", () => {
    expect(buildQuestion({ kind: "score", instructions: "How urgent?", criteria: "not urgent, somewhat, very" })).toEqual({
      type: "score",
      instructions: "How urgent?",
      criteria: ["not urgent", "somewhat", "very"],
    });
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
    const fetchFn = ok({ answers: { answer: { type: "noul", noul: 0.03 } } }, { "x-ratelimit-remaining": "3" });
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", state: "The sky is blue.", question: { type: "noul", instructions: "Is the sky green?" } });
    expect(res).toMatchObject({ ok: true, answer: "No (3%)", remaining: 3, status: 200 });
    expect(typeof res.latencyMs).toBe("number");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/internal/jev?invite=beta");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer mm_sk_abc");
    expect(JSON.parse(init.body)).toEqual({ state: "The sky is blue.", questions: { answer: { type: "noul", instructions: "Is the sky green?" } } });
  });

  it("returns a friendly error and the retry hint on 429", async () => {
    const fetchFn = ok({ error: "Rate limit" }, { "retry-after": "9" }, 429);
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", state: "x", question: { type: "noul", instructions: "?" } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/9 seconds/);
    expect(res.status).toBe(429);
  });

  it("reports a network failure without throwing", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("offline"));
    const res = await askJev(fetchFn, { invite: "beta", apiKey: "mm_sk_abc", state: "x", question: { type: "noul", instructions: "?" } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/offline|network/i);
  });
});
