import "server-only";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * Server-side project_tracks writes. Every caller must check the user's
 * rights first; these helpers take the service client and bypass RLS.
 *
 * Writes go through set_project_tracks (202611131500), which applies a whole
 * batch in one statement: a failure leaves every project's tracks unchanged.
 */

export type TrackAssignment = { projectId: string; trackIds: string[] };

export type TrackWriteFailure = {
  ok: false;
  status: 400 | 500;
  error: string;
  code: "track_not_in_event" | "track_write_failed";
};

export type TrackWriteResult =
  | { ok: true; added: number; removed: number }
  | TrackWriteFailure;

const TRACK_NOT_IN_EVENT: TrackWriteFailure = {
  ok: false,
  status: 400,
  error: "One or more tracks do not belong to this project's event",
  code: "track_not_in_event",
};

const TRACK_WRITE_FAILED: TrackWriteFailure = {
  ok: false,
  status: 500,
  error: "Failed to update project tracks",
  code: "track_write_failed",
};

const unique = (ids: string[]) => Array.from(new Set(ids));

/**
 * Set project tracks atomically.
 * - `replace: true`: each listed project ends with exactly its trackIds
 *   (an empty list clears the project's tracks).
 * - `replace: false`: trackIds are added and existing tracks are kept.
 */
export async function setProjectTracks(
  service: ServiceSupabaseClient,
  assignments: TrackAssignment[],
  { replace }: { replace: boolean },
): Promise<TrackWriteResult> {
  if (assignments.length === 0) return { ok: true, added: 0, removed: 0 };

  const { data, error } = await service.rpc("set_project_tracks", {
    p_assignments: assignments.map((assignment) => ({
      project_id: assignment.projectId,
      track_ids: unique(assignment.trackIds),
    })),
    p_replace: replace,
  });

  if (error) {
    // enforce_project_track_same_event; the whole batch was rolled back.
    if (error.code === "23514") return TRACK_NOT_IN_EVENT;
    console.error("[project-tracks] set_project_tracks failed", {
      projectIds: assignments.map((assignment) => assignment.projectId),
      error,
    });
    return TRACK_WRITE_FAILED;
  }

  const counts = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    added: Number(counts?.added ?? 0),
    removed: Number(counts?.removed ?? 0),
  };
}

/**
 * Track ids from `trackIds` that are not tracks of `eventId`. Checked before
 * writing so callers can return a clear 400; the database trigger is the
 * backstop. Returns `null` when the lookup itself fails.
 */
export async function findTracksOutsideEvent(
  service: ServiceSupabaseClient,
  eventId: string,
  trackIds: string[],
): Promise<string[] | null> {
  const requested = unique(trackIds);
  if (requested.length === 0) return [];

  const { data, error } = await service
    .from("event_tracks")
    .select("track_id")
    .eq("event_id", eventId)
    .in("track_id", requested);

  if (error) {
    console.error("[project-tracks] event track lookup failed", { eventId, error });
    return null;
  }

  const valid = new Set((data ?? []).map((row) => row.track_id));
  return requested.filter((trackId) => !valid.has(trackId));
}
