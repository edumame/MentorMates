import { clampPerProject } from "./auto-assign";

describe("clampPerProject (JUDGE-008)", () => {
  it("clamps to 1..pool size", () => {
    expect(clampPerProject(3, 1)).toBe(1);
    expect(clampPerProject(3, 5)).toBe(3);
    expect(clampPerProject(0, 5)).toBe(1);
    expect(clampPerProject(-2, 5)).toBe(1);
    expect(clampPerProject(9, 0)).toBe(1);
    expect(clampPerProject(2.7, 5)).toBe(2);
  });

  it("falls back to min(3, pool) for NaN input", () => {
    expect(clampPerProject(NaN, 2)).toBe(2);
    expect(clampPerProject(NaN, 10)).toBe(3);
  });
});
