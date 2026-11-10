/**
 * Pure helpers for the unsaved scoring-config draft shared by the track form
 * and the judging sidebar.
 */

import type { EventScoringConfig } from "@/lib/types";

/**
 * Apply an assistant patch to the current draft. `sentConfig` is the draft the
 * assistant was shown, so a track that changed since then (draft updates are
 * immutable, so its reference differs) was touched by the organizer during the
 * request: their edit or deletion wins over the patch.
 */
export function mergeAssistantPatch(
  current: EventScoringConfig,
  sentConfig: EventScoringConfig,
  patch: Partial<EventScoringConfig> & Pick<EventScoringConfig, "tracks">
): EventScoringConfig {
  const tracks = { ...current.tracks };

  for (const [trackId, patchedTrack] of Object.entries(patch.tracks)) {
    const changedSinceSent =
      trackId in sentConfig.tracks &&
      current.tracks[trackId] !== sentConfig.tracks[trackId];
    if (!changedSinceSent) {
      tracks[trackId] = patchedTrack;
    }
  }

  for (const trackId of Object.keys(sentConfig.tracks)) {
    const removedByPatch = !(trackId in patch.tracks);
    if (removedByPatch && current.tracks[trackId] === sentConfig.tracks[trackId]) {
      delete tracks[trackId];
    }
  }

  return { ...current, ...patch, tracks };
}

/**
 * Add the tracks parsed from a rubric to the current draft. Existing tracks and
 * rounds are kept: Save never deletes event_tracks rows, so dropping them here
 * would only lose unsaved edits. A parsed id that is already in the draft gets a
 * fresh id rather than overwriting that track.
 */
export function mergeParsedRubric(
  current: EventScoringConfig,
  parsed: EventScoringConfig
): EventScoringConfig {
  const tracks = { ...current.tracks };

  for (const [trackId, parsedTrack] of Object.entries(parsed.tracks)) {
    tracks[trackId in tracks ? crypto.randomUUID() : trackId] = parsedTrack;
  }

  return { ...current, ...parsed, rounds: current.rounds, tracks };
}
