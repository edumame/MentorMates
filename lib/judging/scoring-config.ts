import type {
  EventScoringConfig,
  EventTrack,
  EventTrackScoringConfig,
  RoundConfig,
  ScoringCriterion,
  TrackScoringConfig,
} from "@/lib/types";
import { getActiveRound, getRoundsConfig } from "@/lib/judging/rounds";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeCriterion(
  criterion: ScoringCriterion
): ScoringCriterion {
  return {
    ...criterion,
    weight: criterion.weight || 1,
    min: criterion.min || 1,
    max: criterion.max || 10,
    type: criterion.type || "numeric",
    options: criterion.options || [],
  };
}

export function normalizeTrackScoringConfig(
  trackConfig: TrackScoringConfig | EventTrackScoringConfig | null | undefined,
  fallbackName?: string | null
): TrackScoringConfig | undefined {
  if (!trackConfig || !Array.isArray(trackConfig.criteria)) {
    return undefined;
  }

  return {
    name: trackConfig.name || fallbackName || "",
    criteria: trackConfig.criteria.map(normalizeCriterion),
  };
}

export function getTrackRoundOverride(
  trackScoringCriteria: EventTrackScoringConfig | TrackScoringConfig | null | undefined,
  roundNumber: number,
  fallbackName?: string | null
): TrackScoringConfig | undefined {
  if (!trackScoringCriteria || !("rounds" in trackScoringCriteria)) {
    return undefined;
  }

  const roundOverrides = trackScoringCriteria.rounds;
  if (!isRecord(roundOverrides)) {
    return undefined;
  }

  return normalizeTrackScoringConfig(
    roundOverrides[String(roundNumber)] as TrackScoringConfig | undefined,
    trackScoringCriteria.name || fallbackName
  );
}

export function buildRoundTrackOverridesByRound(
  eventTracks?: Pick<EventTrack, "track_id" | "name" | "scoring_criteria">[] | null
): Record<number, Record<string, TrackScoringConfig>> {
  const roundOverrides: Record<number, Record<string, TrackScoringConfig>> = {};

  (eventTracks || []).forEach((track) => {
    const trackRounds =
      isRecord(track.scoring_criteria) &&
      "rounds" in track.scoring_criteria &&
      isRecord(track.scoring_criteria.rounds)
        ? track.scoring_criteria.rounds
        : undefined;

    Object.entries(trackRounds || {}).forEach(([roundKey, roundConfig]) => {
      const roundNumber = Number(roundKey);
      if (!Number.isInteger(roundNumber) || roundNumber <= 0) return;

      const normalized = normalizeTrackScoringConfig(
        roundConfig as TrackScoringConfig,
        track.name || track.track_id
      );
      if (!normalized) return;

      if (!roundOverrides[roundNumber]) {
        roundOverrides[roundNumber] = {};
      }

      roundOverrides[roundNumber][track.track_id] = normalized;
    });
  });

  return roundOverrides;
}

export function buildRoundOverridesByTrack(
  rounds?: RoundConfig[] | null
): Record<string, Record<string, TrackScoringConfig>> {
  return (rounds || []).reduce<Record<string, Record<string, TrackScoringConfig>>>(
    (acc, round) => {
      Object.entries(round.tracks || {}).forEach(([trackId, trackConfig]) => {
        if (!acc[trackId]) {
          acc[trackId] = {};
        }

        acc[trackId][String(round.round_number)] = normalizeTrackScoringConfig(
          trackConfig,
          trackConfig.name
        ) || trackConfig;
      });

      return acc;
    },
    {}
  );
}

export function stripRoundTrackOverrides(
  rounds?: RoundConfig[] | null
): RoundConfig[] | undefined {
  if (!rounds?.length) {
    return undefined;
  }

  return rounds.map((round) => ({
    round_number: round.round_number,
    name: round.name,
    advancement_count: round.advancement_count,
    criteria: round.criteria,
    judges: round.judges,
  }));
}

export function buildEventTrackScoringCriteriaFromConfig(params: {
  trackId: string;
  trackConfig: TrackScoringConfig;
  rounds?: RoundConfig[] | null;
}): EventTrackScoringConfig {
  const { trackId, trackConfig, rounds } = params;
  const roundOverrides = buildRoundOverridesByTrack(rounds)[trackId];

  return {
    name: trackConfig.name,
    criteria: trackConfig.criteria.map(normalizeCriterion),
    rounds:
      roundOverrides && Object.keys(roundOverrides).length > 0
        ? roundOverrides
        : undefined,
  };
}

export function getRoundConfig(
  scoringConfig: EventScoringConfig | null | undefined,
  roundNumber: number
): RoundConfig | null {
  return (
    getRoundsConfig(scoringConfig).find(
      (round) => round.round_number === roundNumber
    ) ?? null
  );
}

export function getTrackScoringConfigForRound(params: {
  scoringConfig: EventScoringConfig | null | undefined;
  trackId: string;
  roundNumber?: number | null;
  fallbackTrackName?: string | null;
  trackScoringCriteria?: EventTrackScoringConfig | TrackScoringConfig | null;
}): TrackScoringConfig | undefined {
  const {
    scoringConfig,
    trackId,
    roundNumber,
    fallbackTrackName,
    trackScoringCriteria,
  } = params;

  const resolvedRound =
    typeof roundNumber === "number" && roundNumber > 0
      ? roundNumber
      : getActiveRound(scoringConfig);

  const directTrackOverride = getTrackRoundOverride(
    trackScoringCriteria,
    resolvedRound,
    fallbackTrackName
  );
  if (directTrackOverride) {
    return directTrackOverride;
  }

  const roundConfig = getRoundConfig(scoringConfig, resolvedRound);

  const roundTrackConfig =
    (roundConfig?.tracks && roundConfig.tracks[trackId]) ||
    (fallbackTrackName
      ? Object.values(roundConfig?.tracks || {}).find(
          (track) => track.name === fallbackTrackName
        )
      : undefined);
  if (roundTrackConfig) {
    return normalizeTrackScoringConfig(roundTrackConfig, fallbackTrackName);
  }

  const baseTrackConfig =
    normalizeTrackScoringConfig(trackScoringCriteria, fallbackTrackName) ||
    scoringConfig?.tracks[trackId] ||
    (fallbackTrackName
      ? Object.values(scoringConfig?.tracks || {}).find(
          (track) => track.name === fallbackTrackName
        )
      : undefined);

  if (roundConfig?.criteria && baseTrackConfig) {
    return {
      name: baseTrackConfig.name || fallbackTrackName || trackId,
      criteria: roundConfig.criteria.map(normalizeCriterion),
    };
  }

  return baseTrackConfig;
}
