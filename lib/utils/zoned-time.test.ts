import { zonedLocalToUtc } from "./zoned-time";

const LA = "America/Los_Angeles";

describe("zonedLocalToUtc (ORG-015)", () => {
  it("converts ordinary times with the zone's offset (incl. DST)", () => {
    expect(zonedLocalToUtc("2026-12-01T10:00", LA)).toEqual({ ok: true, iso: "2026-12-01T18:00:00.000Z", ambiguous: false });
    expect(zonedLocalToUtc("2026-07-01 10:00:30", LA)).toEqual({ ok: true, iso: "2026-07-01T17:00:30.000Z", ambiguous: false });
    expect(zonedLocalToUtc("2026-12-01T10:00", "Asia/Tokyo")).toMatchObject({ iso: "2026-12-01T01:00:00.000Z" });
  });

  it("rejects a nonexistent spring-forward time with a clear message", () => {
    const result = zonedLocalToUtc("2026-03-08T02:30", LA);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/does not exist in America\/Los_Angeles/);
  });

  it("resolves an ambiguous fall-back time to the earlier instant", () => {
    // 01:30 happens twice on 2026-11-01: first at UTC-7 (08:30Z), then UTC-8 (09:30Z).
    expect(zonedLocalToUtc("2026-11-01T01:30", LA)).toEqual({ ok: true, iso: "2026-11-01T08:30:00.000Z", ambiguous: true });
  });

  it.each(["", "tomorrow", "2026-13-45T99:99", "2026-12-01"])("rejects invalid input %p", (value) => {
    expect(zonedLocalToUtc(value, LA).ok).toBe(false);
  });

  it("rejects an unknown time zone", () => {
    expect(zonedLocalToUtc("2026-12-01T10:00", "Mars/Olympus").ok).toBe(false);
  });
});
