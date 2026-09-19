import { checkInvite, decideRateLimit, buildUpstreamBody, JEV_MODEL } from "./jev";

const now = new Date("2026-09-19T10:00:00Z");

describe("checkInvite", () => {
  const base = {
    id: "inv-1",
    code: "abc",
    service: "jev",
    revoked_at: null,
    expires_at: null,
    max_uses: null,
    uses: 0,
  };

  it("accepts a live invite for the right service", () => {
    expect(checkInvite(base, "jev", now)).toEqual({ ok: true });
  });

  it("rejects a missing invite", () => {
    expect(checkInvite(null, "jev", now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an invite for a different service", () => {
    expect(checkInvite({ ...base, service: "other" }, "jev", now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a revoked invite", () => {
    expect(checkInvite({ ...base, revoked_at: "2026-09-18T00:00:00Z" }, "jev", now)).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects an expired invite", () => {
    expect(checkInvite({ ...base, expires_at: "2026-09-19T09:59:59Z" }, "jev", now)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects an invite whose uses are exhausted", () => {
    expect(checkInvite({ ...base, max_uses: 10, uses: 10 }, "jev", now)).toEqual({ ok: false, reason: "exhausted" });
  });
});

describe("decideRateLimit", () => {
  it("allows the fifth call when four were made this minute, with none remaining after it", () => {
    expect(decideRateLimit(4, { limit: 5 })).toEqual({ allowed: true, remaining: 0 });
  });

  it("reports four remaining after the first call of a fresh minute", () => {
    expect(decideRateLimit(0, { limit: 5 })).toEqual({ allowed: true, remaining: 4 });
  });

  it("blocks the sixth call and tells the client when to retry", () => {
    const oldest = new Date("2026-09-19T09:59:20Z");
    expect(decideRateLimit(5, { limit: 5, windowMs: 60_000, oldestInWindow: oldest, now })).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 20,
    });
  });

  it("never reports a retry of less than one second", () => {
    const oldest = new Date("2026-09-19T09:59:00.500Z");
    expect(decideRateLimit(5, { limit: 5, windowMs: 60_000, oldestInWindow: oldest, now }).retryAfterSeconds).toBe(1);
  });
});

describe("buildUpstreamBody (Typesafe /v1/systemone shape)", () => {
  const q = { verdict: { type: "noul", instructions: "Is this urgent?" } };

  it("pins the model and passes state and questions through", () => {
    expect(buildUpstreamBody({ model: "gpt-5.4", state: "Payouts failing for 3 days", questions: q })).toEqual({
      model: JEV_MODEL,
      state: "Payouts failing for 3 days",
      questions: q,
    });
  });

  it("accepts object state", () => {
    const body = buildUpstreamBody({ state: { subject: "x", body: "y" }, questions: q });
    expect(body.state).toEqual({ subject: "x", body: "y" });
  });

  it("rejects a body with no state", () => {
    expect(() => buildUpstreamBody({ questions: q })).toThrow(/state/);
  });

  it("rejects a body with no questions", () => {
    expect(() => buildUpstreamBody({ state: "x" })).toThrow(/questions/);
    expect(() => buildUpstreamBody({ state: "x", questions: {} })).toThrow(/questions/);
  });

  it("rejects an unknown question type", () => {
    expect(() => buildUpstreamBody({ state: "x", questions: { a: { type: "essay", instructions: "?" } } })).toThrow(/type/);
  });

  it("requires criteria for choice and score questions", () => {
    expect(() => buildUpstreamBody({ state: "x", questions: { a: { type: "choice", instructions: "?" } } })).toThrow(/criteria/);
    expect(() => buildUpstreamBody({ state: "x", questions: { a: { type: "score", instructions: "?", criteria: ["only one"] } } })).toThrow(/criteria/);
  });

  it("caps the number of questions at 10", () => {
    const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`q${i}`, { type: "noul", instructions: "?" }]));
    expect(() => buildUpstreamBody({ state: "x", questions: many })).toThrow(/10/);
  });

  it("rejects a payload over 32 KB", () => {
    expect(() => buildUpstreamBody({ state: "x".repeat(33_000), questions: q })).toThrow(/32 KB/);
  });
});
