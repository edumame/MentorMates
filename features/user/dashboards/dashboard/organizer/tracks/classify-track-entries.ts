/**
 * Classify scoring-config track entries into "existing" (real UUID already in
 * DB) and "new" (client-generated ID that must NOT be sent as track_id).
 *
 * New tracks omit track_id so the database DEFAULT (gen_random_uuid()) fills it.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (UUID_RE.test(trackId) && existingDbTrackIds.has(trackId)) {
      existing.push({ ...entry, track_id: trackId });
    } else {
      // New track — no track_id, let DB generate
      newTracks.push(entry);
    }
  }

  return { existing, newTracks };
}
