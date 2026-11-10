import type { ScoringCriterion } from "@/lib/types";

/**
 * Single source of truth for turning one judge's rubric answers into a score
 * (JUDGE-007). Used by the judge dashboard navigator, the organizer
 * leaderboard/CSV exports and round advancement ranking
 * (lib/judging/advancement-ranking.ts), so the same scores rank the same
 * everywhere.
 *
 * Rules:
 * - Only numeric criteria count (multiple-choice criteria are reported
 *   separately).
 * - Each value is normalised to 0..1 by its own criterion range
 *   ((v - min) / (max - min); missing min = 0, missing max = 10), so a 1-5
 *   and a 1-10 criterion contribute equally at the same relative score.
 * - weight defaults to 1 when unset (`weight ?? 1`); weight 0 (or negative)
 *   excludes the criterion.
 * - The weighted mean of the normalised values is reported on a 0..10 scale
 *   (SCORE_SCALE_MAX): a perfect scorecard is 10, the lowest possible is 0.
 * - A scorecard is complete only when every weighted numeric criterion has a
 *   valid value. Incomplete scorecards (unanswered, out-of-range or
 *   non-numeric values, e.g. legacy rows written before server-side rubric
 *   validation) get score null and are excluded rather than inflated or
 *   clamped; the offending criteria are reported.
 */

/** Display scale of computed scores (0..SCORE_SCALE_MAX). */
export const SCORE_SCALE_MAX = 10;
export const DEFAULT_CRITERION_MIN = 0;
export const DEFAULT_CRITERION_MAX = 10;

export interface WeightedScoreResult {
  /** 0..SCORE_SCALE_MAX, or null when the scorecard is incomplete/invalid. */
  score: number | null;
  /** Criteria that had a value outside the rubric range or not a number. */
  invalidCriterionIds: string[];
  /** Weighted numeric criteria without an answer. */
  missingCriterionIds: string[];
  /** Valid numeric values per criterion id (raw, on the criterion's scale). */
  validValues: Record<string, number>;
}

export function isNumericCriterion(criterion: ScoringCriterion): boolean {
  return criterion.type !== "multiplechoice";
}

export function criterionWeight(criterion: ScoringCriterion): number {
  const weight = criterion.weight ?? 1;
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

export function toNumericScore(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function criterionRange(criterion: ScoringCriterion): { min: number; max: number } {
  const min = typeof criterion.min === "number" ? criterion.min : DEFAULT_CRITERION_MIN;
  const max = typeof criterion.max === "number" ? criterion.max : DEFAULT_CRITERION_MAX;
  return { min, max };
}

/** Value normalised to 0..1 by the criterion's own range. */
export function normalizeCriterionValue(criterion: ScoringCriterion, value: number): number {
  const { min, max } = criterionRange(criterion);
  if (max <= min) return 1;
  return (value - min) / (max - min);
}

function isWithinRange(criterion: ScoringCriterion, value: number): boolean {
  const { min, max } = criterionRange(criterion);
  return value >= min && value <= Math.max(min, max);
}

export function computeWeightedScore(
  scores: Record<string, unknown> | null | undefined,
  criteria: ScoringCriterion[]
): WeightedScoreResult {
  const result: WeightedScoreResult = {
    score: null,
    invalidCriterionIds: [],
    missingCriterionIds: [],
    validValues: {},
  };

  let weightedSum = 0;
  let totalWeight = 0;
  let invalidWeighted = 0;
  for (const criterion of criteria) {
    if (!isNumericCriterion(criterion)) continue;
    const weight = criterionWeight(criterion);
    const raw = scores?.[criterion.id];
    if (raw === undefined || raw === null || raw === "") {
      if (weight > 0) result.missingCriterionIds.push(criterion.id);
      continue;
    }
    const value = toNumericScore(raw);
    if (value === null || !isWithinRange(criterion, value)) {
      result.invalidCriterionIds.push(criterion.id);
      if (weight > 0) invalidWeighted += 1;
      continue;
    }
    result.validValues[criterion.id] = value;
    weightedSum += normalizeCriterionValue(criterion, value) * weight;
    totalWeight += weight;
  }

  const complete = result.missingCriterionIds.length === 0 && invalidWeighted === 0;
  result.score =
    complete && totalWeight > 0 ? (weightedSum / totalWeight) * SCORE_SCALE_MAX : null;
  return result;
}

/**
 * Standard competition ranking ("1, 2, 2, 4") for values sorted by the
 * caller's order; equal scores share a rank. Values are compared after
 * rounding to `precision` decimals so floating noise does not split ties.
 */
export function competitionRanks(values: number[], precision = 6): number[] {
  const factor = 10 ** precision;
  const rounded = values.map((value) => Math.round(value * factor));
  const ranks: number[] = [];
  rounded.forEach((value, index) => {
    if (index > 0 && value === rounded[index - 1]) {
      ranks.push(ranks[index - 1]);
    } else {
      ranks.push(index + 1);
    }
  });
  return ranks;
}
