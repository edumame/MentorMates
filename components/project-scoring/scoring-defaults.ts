import { ScoringCriterion } from "@/lib/types";

export function getDefaultScores(
  criteria: ScoringCriterion[]
): Record<string, number | string> {
  const defaultScores: Record<string, number | string> = {};

  criteria.forEach((criterion) => {
    if (criterion.type === "multiplechoice") {
      defaultScores[criterion.id] = "";
      return;
    }

    defaultScores[criterion.id] = criterion.min ?? 0;
  });

  return defaultScores;
}
