import type {
  EventScoringConfig,
  EventTrack,
  RoundConfig,
} from "@/lib/types";
import {
  buildRoundTrackOverridesByRound,
  normalizeTrackScoringConfig,
} from "@/lib/judging/scoring-config";

type EventScoringConfigSource = {
  event_tracks?: EventTrack[] | null;
  scoring_config?: EventScoringConfig | null;
};

function buildTracksConfig(eventTracks?: EventTrack[] | null) {
  const tracks = (eventTracks || []).reduce<EventScoringConfig["tracks"]>(
    (acc, track) => {
      if (!track.track_id || !track.scoring_criteria) return acc;

      const normalized = normalizeTrackScoringConfig(
        track.scoring_criteria,
        track.name
      );
      if (!normalized) return acc;

      acc[track.track_id] = normalized;

      return acc;
    },
    {}
  );

  return tracks;
}

function buildRoundsConfig(
  persistedRounds: RoundConfig[] | undefined,
  eventTracks?: EventTrack[] | null
) {
  if (!persistedRounds?.length) {
    return undefined;
  }

  const roundTrackOverrides = buildRoundTrackOverridesByRound(eventTracks);

  return [...persistedRounds]
    .sort((a, b) => a.round_number - b.round_number)
    .map((round) => {
      const mergedTracks = {
        ...(round.tracks || {}),
        ...(roundTrackOverrides[round.round_number] || {}),
      };

      return {
        ...round,
        tracks:
          Object.keys(mergedTracks).length > 0 ? mergedTracks : undefined,
      };
    });
}

export function buildEventScoringConfig(
  source: EventScoringConfigSource | null | undefined
): EventScoringConfig | null {
  const persistedConfig = source?.scoring_config ?? null;
  const tracks = buildTracksConfig(source?.event_tracks);
  const hasTrackConfig = Object.keys(tracks).length > 0;

  if (!persistedConfig && !hasTrackConfig) {
    return null;
  }

  return {
    tracks: hasTrackConfig ? tracks : persistedConfig?.tracks || {},
    defaultMin: persistedConfig?.defaultMin ?? 1,
    defaultMax: persistedConfig?.defaultMax ?? 10,
    defaultWeight: persistedConfig?.defaultWeight ?? 1,
    rounds: buildRoundsConfig(persistedConfig?.rounds, source?.event_tracks),
    activeRound: persistedConfig?.activeRound,
  };
}
