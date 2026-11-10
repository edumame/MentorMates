import { parseUtcTimestamp } from "./parse-utc-timestamp";

describe("parseUtcTimestamp", () => {
  it.each([
    ["2026-11-09T03:16:26", "2026-11-09T03:16:26.000Z"],
    ["2026-11-09 03:16:26.452391", "2026-11-09T03:16:26.452Z"],
    ["2026-11-09T03:16:26+00:00", "2026-11-09T03:16:26.000Z"],
    ["2026-11-09T03:16:26.5Z", "2026-11-09T03:16:26.500Z"],
    ["2026-11-08T19:16:26-08:00", "2026-11-09T03:16:26.000Z"],
  ])("treats %s as UTC unless an offset is given", (input, expected) => {
    expect(parseUtcTimestamp(input)?.toISOString()).toBe(expected);
  });
  it.each([null, undefined, "", "not a date"])("returns null for %p", (input) => {
    expect(parseUtcTimestamp(input)).toBeNull();
  });
});
