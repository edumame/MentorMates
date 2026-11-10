import { getActiveRound } from "@/lib/judging/rounds";

describe("getActiveRound", () => {
  const cfg = (activeRound: unknown) => ({ tracks: {}, activeRound } as never);

  it("returns a positive integer activeRound", () => {
    expect(getActiveRound(cfg(2))).toBe(2);
    expect(getActiveRound(cfg(1))).toBe(1);
  });

  it("falls back to round 1 for missing, non-positive or non-integer values (matches DB)", () => {
    expect(getActiveRound(null)).toBe(1);
    expect(getActiveRound(undefined)).toBe(1);
    expect(getActiveRound(cfg(undefined))).toBe(1);
    expect(getActiveRound(cfg(0))).toBe(1);
    expect(getActiveRound(cfg(-3))).toBe(1);
    expect(getActiveRound(cfg(1.5))).toBe(1);
    expect(getActiveRound(cfg("2"))).toBe(1);
    expect(getActiveRound(cfg(Number.NaN))).toBe(1);
  });
});
