import type { ScoringCriterion } from "@/lib/types";
import { getTrackScoringConfigForRound, normalizeCriterion } from "./scoring-config";
import { computeWeightedScore } from "./weighted-score";

// Zero is a real value (JUDGE-004/JUDGE-007 follow-up): nullish, not falsy, defaults.
const yesNo: ScoringCriterion = { id: "yn", name: "Ready?", description: "", type: "numeric", min: 0, max: 1, weight: 1 };
const quality: ScoringCriterion = { id: "q", name: "Quality", description: "", type: "numeric", min: 1, max: 10, weight: 2 };

describe("normalizeCriterion defaults", () => {
  it("keeps explicit zeros for min, max and weight", () => {
    expect(normalizeCriterion({ ...yesNo, weight: 0 })).toMatchObject({ min: 0, max: 1, weight: 0 });
  });

  it("defaults only missing values (min 1, max 10, weight 1)", () => {
    expect(normalizeCriterion({ id: "x", name: "X", description: "" })).toMatchObject({
      min: 1,
      max: 10,
      weight: 1,
      type: "numeric",
      options: [],
    });
  });

  it("flows through track resolution (Yes/No template keeps min 0)", () => {
    const config = getTrackScoringConfigForRound({
      scoringConfig: { tracks: {} },
      trackId: "t",
      roundNumber: 1,
      trackScoringCriteria: { name: "T", criteria: [{ ...yesNo, min: 0, weight: 0 }] },
    });
    expect(config?.criteria[0]).toMatchObject({ min: 0, max: 1, weight: 0 });
  });
});

describe("computeWeightedScore with zero-valued rubric settings", () => {
  it("counts a Yes/No answer of 0 as a valid score", () => {
    expect(computeWeightedScore({ yn: 0 }, [normalizeCriterion(yesNo)])).toMatchObject({
      score: 0,
      invalidCriterionIds: [],
      validValues: { yn: 0 },
    });
  });

  it("excludes weight-0 criteria from weighting but still validates them", () => {
    const criteria = [normalizeCriterion({ ...yesNo, weight: 0 }), normalizeCriterion(quality)];
    const qualityOnly = computeWeightedScore({ q: 6 }, [normalizeCriterion(quality)]).score;
    expect(qualityOnly).not.toBeNull();
    expect(computeWeightedScore({ yn: 1, q: 6 }, criteria)).toMatchObject({ score: qualityOnly, invalidCriterionIds: [] });
    expect(computeWeightedScore({ yn: 0, q: 6 }, criteria)).toMatchObject({ score: qualityOnly, invalidCriterionIds: [] });
    // Out-of-range weight-0 value is flagged but does not invalidate the scorecard.
    expect(computeWeightedScore({ yn: 5, q: 6 }, criteria)).toMatchObject({ score: qualityOnly, invalidCriterionIds: ["yn"] });
  });

  it("weights a Yes/No criterion like any other when its weight is non-zero", () => {
    const criteria = [normalizeCriterion(yesNo), normalizeCriterion({ ...quality, weight: 1 })];
    expect(computeWeightedScore({ yn: 0, q: 10 }, criteria).score).toBeCloseTo(5);
    expect(computeWeightedScore({ yn: 1, q: 10 }, criteria).score).toBeCloseTo(10);
  });

  it("returns null when only weight-0 criteria were answered", () => {
    expect(computeWeightedScore({ yn: 1 }, [normalizeCriterion({ ...yesNo, weight: 0 })]).score).toBeNull();
  });
});
