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

/**
 * Builds the `scores` payload for project_scores from the current rubric only.
 * Keys for criteria that are no longer on the rubric are dropped (the database
 * rejects unknown criterion ids), numeric strings are coerced to numbers, and
 * missing numeric values fall back to the criterion minimum.
 */
export function buildScoresPayload(
  criteria: ScoringCriterion[],
  values: Record<string, unknown> | null | undefined
): Record<string, number | string> {
  const defaults = getDefaultScores(criteria);
  const payload: Record<string, number | string> = {};

  criteria.forEach((criterion) => {
    const raw = values?.[criterion.id];

    if (criterion.type === "multiplechoice") {
      payload[criterion.id] =
        typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
      return;
    }

    const numeric =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : NaN;
    payload[criterion.id] = Number.isFinite(numeric)
      ? numeric
      : defaults[criterion.id];
  });

  return payload;
}

const SCORE_SAVE_ERROR_MESSAGES: Record<string, string> = {
  "42501":
    "You can only score projects assigned to you in the current judging round.",
  "23505": "A score for this project already exists. Refresh and try again.",
};

/** User-facing message for a failed project_scores write. */
export function getScoreSaveErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (code === "23514" && message) return message;
  return SCORE_SAVE_ERROR_MESSAGES[code] ?? "Failed to save your evaluation";
}
