import type { ScoringCriterion } from "@/lib/types";
import { competitionRanks, computeWeightedScore, SCORE_SCALE_MAX } from "./weighted-score";

const c = (id: string, extra: Partial<ScoringCriterion> = {}): ScoringCriterion => ({
  id,
  name: id,
  description: "",
  min: 1,
  max: 10,
  type: "numeric",
  ...extra,
});

describe("computeWeightedScore (JUDGE-007)", () => {
  // Fixture rubric from the audit: Innovation w2 (1-10), Technical w1 (1-5).
  const rubric = [c("inn", { weight: 2 }), c("tech", { weight: 1, max: 5 })];

  it("maps a perfect scorecard to the scale max and the lowest one to 0, across mixed ranges", () => {
    expect(computeWeightedScore({ inn: 10, tech: 5 }, rubric).score).toBe(SCORE_SCALE_MAX);
    expect(computeWeightedScore({ inn: 1, tech: 1 }, rubric).score).toBe(0);
  });

  it("normalises each criterion by its own range before weighting", () => {
    // inn 1/1 normalised 0, tech 5/5 normalised 1 -> (0*2 + 1*1)/3 * 10
    expect(computeWeightedScore({ inn: 1, tech: 5 }, rubric).score).toBeCloseTo(10 / 3, 10);
    // equal relative scores give the same result regardless of range
    expect(computeWeightedScore({ inn: 5.5, tech: 3 }, rubric).score).toBeCloseTo(5, 10);
  });

  it("defaults a missing weight to 1 and excludes weight 0 / negative weights", () => {
    expect(computeWeightedScore({ a: 4, b: 10 }, [c("a"), c("b")]).score).toBeCloseTo(((3 / 9 + 1) / 2) * 10, 10);
    expect(computeWeightedScore({ a: 1, b: 10 }, [c("a", { weight: 0 }), c("b")]).score).toBe(10);
    expect(computeWeightedScore({ a: 1, b: 10 }, [c("a", { weight: -3 }), c("b")]).score).toBe(10);
    expect(computeWeightedScore({ a: 4 }, [c("a", { weight: 0 })]).score).toBeNull();
  });

  it("treats a partial scorecard as incomplete instead of inflating it", () => {
    const result = computeWeightedScore({ inn: 10 }, rubric);
    expect(result.score).toBeNull();
    expect(result.missingCriterionIds).toEqual(["tech"]);
  });

  it("does not require answers for weight-0 criteria", () => {
    expect(computeWeightedScore({ a: 10 }, [c("a"), c("z", { weight: 0 })]).score).toBe(10);
  });

  it("marks out-of-range or non-numeric values invalid and the scorecard incomplete", () => {
    const result = computeWeightedScore({ a: 9999, b: "x", d: 0, e: "7" }, [c("a"), c("b"), c("d"), c("e")]);
    expect(result.score).toBeNull();
    expect(result.invalidCriterionIds).toEqual(["a", "b", "d"]);
    expect(result.validValues).toEqual({ e: 7 });
  });

  it("ignores multiple-choice criteria and handles null scores", () => {
    expect(computeWeightedScore({ a: 10, m: "Best AI" }, [c("a"), c("m", { type: "multiplechoice" })]).score).toBe(10);
    expect(computeWeightedScore(null, [c("a")]).score).toBeNull();
  });

  it("uses default bounds 0..10 when min/max are unset", () => {
    expect(computeWeightedScore({ a: 5 }, [c("a", { min: undefined, max: undefined })]).score).toBe(5);
    expect(computeWeightedScore({ a: -1 }, [c("a", { min: undefined, max: undefined })]).score).toBeNull();
    expect(computeWeightedScore({ a: 50 }, [c("a", { min: undefined, max: undefined })]).score).toBeNull();
  });

  it("treats a single-value range as full marks", () => {
    expect(computeWeightedScore({ a: 1 }, [c("a", { min: 1, max: 1 })]).score).toBe(10);
  });
});

describe("competitionRanks", () => {
  it("shares ranks for ties and skips after them", () => {
    expect(competitionRanks([9, 9, 7, 7, 7, 1])).toEqual([1, 1, 3, 3, 3, 6]);
    expect(competitionRanks([0.1 + 0.2, 0.3])).toEqual([1, 1]);
    expect(competitionRanks([])).toEqual([]);
  });
});
