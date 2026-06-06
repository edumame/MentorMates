import {
  computeEffectiveCutoff,
  isLateSubmission,
  isWithinLateBuffer,
} from "./submission-deadline";

describe("computeEffectiveCutoff", () => {
  const cutoff = "2026-06-06T12:00:00.000Z";
  const cutoffDate = new Date(cutoff);

  it("returns null when cutoff is null", () => {
    expect(computeEffectiveCutoff(null, 15)).toBeNull();
  });

  it("returns null when cutoff is invalid", () => {
    expect(computeEffectiveCutoff("not-a-date", 15)).toBeNull();
  });

  it("returns cutoff itself when buffer is 0", () => {
    const result = computeEffectiveCutoff(cutoff, 0);
    expect(result).toEqual(cutoffDate);
  });

  it("returns cutoff itself when buffer is null", () => {
    const result = computeEffectiveCutoff(cutoff, null);
    expect(result).toEqual(cutoffDate);
  });

  it("adds 15 minutes when buffer is 15", () => {
    const result = computeEffectiveCutoff(cutoff, 15);
    expect(result?.toISOString()).toBe("2026-06-06T12:15:00.000Z");
  });

  it("treats negative buffer as 0", () => {
    const result = computeEffectiveCutoff(cutoff, -10);
    expect(result).toEqual(cutoffDate);
  });

  it("treats non-finite buffer as 0", () => {
    expect(computeEffectiveCutoff(cutoff, Number.NaN)).toEqual(cutoffDate);
  });

  it("accepts a Date instance for cutoff", () => {
    const result = computeEffectiveCutoff(cutoffDate, 30);
    expect(result?.toISOString()).toBe("2026-06-06T12:30:00.000Z");
  });

  it("floors fractional buffer minutes", () => {
    const result = computeEffectiveCutoff(cutoff, 15.9);
    expect(result?.toISOString()).toBe("2026-06-06T12:15:00.000Z");
  });
});

describe("isLateSubmission", () => {
  const cutoff = "2026-06-06T12:00:00.000Z";

  it("returns false when submitted_at is null", () => {
    expect(isLateSubmission(null, cutoff)).toBe(false);
  });

  it("returns false when cutoff is null", () => {
    expect(isLateSubmission("2026-06-06T13:00:00.000Z", null)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(isLateSubmission(null, null)).toBe(false);
  });

  it("returns false when submitted before cutoff", () => {
    expect(isLateSubmission("2026-06-06T11:59:00.000Z", cutoff)).toBe(false);
  });

  it("returns false when submitted exactly at cutoff", () => {
    expect(isLateSubmission(cutoff, cutoff)).toBe(false);
  });

  it("returns true when submitted 1 second after cutoff", () => {
    expect(isLateSubmission("2026-06-06T12:00:01.000Z", cutoff)).toBe(true);
  });

  it("returns true when submitted well after cutoff", () => {
    expect(isLateSubmission("2026-06-06T13:30:00.000Z", cutoff)).toBe(true);
  });

  it("accepts Date instances", () => {
    expect(
      isLateSubmission(new Date("2026-06-06T13:00:00.000Z"), new Date(cutoff)),
    ).toBe(true);
  });
});

describe("isWithinLateBuffer", () => {
  const cutoff = "2026-06-06T12:00:00.000Z";

  it("returns false when cutoff is null", () => {
    expect(isWithinLateBuffer(new Date(), null, 15)).toBe(false);
  });

  it("returns false when buffer is 0", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:05:00.000Z"), cutoff, 0),
    ).toBe(false);
  });

  it("returns false when buffer is null", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:05:00.000Z"), cutoff, null),
    ).toBe(false);
  });

  it("returns false when now is before cutoff", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T11:59:00.000Z"), cutoff, 15),
    ).toBe(false);
  });

  it("returns false when now is exactly at cutoff (not late yet)", () => {
    expect(
      isWithinLateBuffer(new Date(cutoff), cutoff, 15),
    ).toBe(false);
  });

  it("returns true when now is between cutoff and cutoff + buffer", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:07:00.000Z"), cutoff, 15),
    ).toBe(true);
  });

  it("returns true at the exact upper edge (cutoff + buffer)", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:15:00.000Z"), cutoff, 15),
    ).toBe(true);
  });

  it("returns false when now is past cutoff + buffer", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:15:01.000Z"), cutoff, 15),
    ).toBe(false);
  });

  it("treats negative buffer as 0 (always false)", () => {
    expect(
      isWithinLateBuffer(new Date("2026-06-06T12:05:00.000Z"), cutoff, -5),
    ).toBe(false);
  });
});
