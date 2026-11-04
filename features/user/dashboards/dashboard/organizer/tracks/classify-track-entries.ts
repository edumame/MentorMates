import type { EventScoringConfig } from "@/lib/types";

/**
 * Classify scoring-config track entries into "existing" (UUID already in DB)
 * and "new" (not in DB yet).
 *
 * A new track with a UUID key keeps that key as its track_id, so the saved row
 * and the in-memory config stay on the same id and later saves and deletes hit
 * that row. A key that is not a UUID cannot be stored, so it omits track_id;
 * call withUuidTrackIds first to give such tracks a stable id.
 *
 * A UUID key missing from this event's rows is not always a client id: a
 * duplicated event's scoring_config keeps the source event's track ids. The
 * insert then hits the primary key, and the caller must re-key those tracks.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withReplacedTrackIds(
  config: EventScoringConfig,
  replacements: Map<string, string>,
): EventScoringConfig {
  if (replacements.size === 0) return config;

  const rekey = <T,>(tracks: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      Object.entries(tracks).map(([trackId, track]) => [
        replacements.get(trackId) ?? trackId,
        track,
      ]),
    );

  return {
    ...config,
    tracks: rekey(config.tracks),
    rounds: config.rounds?.map((round) =>
      round.tracks ? { ...round, tracks: rekey(round.tracks) } : round,
    ),
  };
}

/** Give the listed tracks generated UUIDs, including in per-round overrides. */
export function withFreshTrackIds(
  config: EventScoringConfig,
  trackIds: string[],
): EventScoringConfig {
  return withReplacedTrackIds(
    config,
    new Map(trackIds.map((trackId) => [trackId, crypto.randomUUID()])),
  );
}

/**
 * Replace track keys that are not UUIDs (AI imports use ids like "track-1234")
 * with generated UUIDs, in both the tracks and the per-round overrides.
 */
export function withUuidTrackIds(config: EventScoringConfig): EventScoringConfig {
  return withFreshTrackIds(
    config,
    Object.keys(config.tracks).filter((trackId) => !UUID_RE.test(trackId)),
  );
}

/** Remove a track from the config, including its per-round overrides. */
export function withoutTrack(
  config: EventScoringConfig,
  trackId: string,
): EventScoringConfig {
  const tracks = { ...config.tracks };
  delete tracks[trackId];

  return {
    ...config,
    tracks,
    rounds: (config.rounds || []).map((round) => {
      if (!round.tracks?.[trackId]) {
        return round;
      }

      const roundTracks = { ...round.tracks };
      delete roundTracks[trackId];

      return {
        ...round,
        tracks: Object.keys(roundTracks).length > 0 ? roundTracks : undefined,
      };
    }),
  };
}

export interface TrackEntry {
  track_id?: string;
  event_id: string;
  name: string;
  description: string;
  scoring_criteria: unknown;
}

export function classifyTrackEntries(
  configTrackIds: string[],
  existingDbTrackIds: Set<string>,
  eventId: string,
  buildEntry: (trackId: string) => { name: string; description: string; scoring_criteria: unknown },
): { existing: TrackEntry[]; newTracks: TrackEntry[] } {
  const existing: TrackEntry[] = [];
  const newTracks: TrackEntry[] = [];

  for (const trackId of configTrackIds) {
    const entry = { event_id: eventId, ...buildEntry(trackId) };
    if (!UUID_RE.test(trackId)) {
      newTracks.push(entry);
    } else if (existingDbTrackIds.has(trackId)) {
      existing.push({ ...entry, track_id: trackId });
    } else {
      newTracks.push({ ...entry, track_id: trackId });
    }
  }

  return { existing, newTracks };
}
