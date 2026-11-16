import { supabase } from "@/lib/supabase";
import { EventTrack } from "@/lib/types";
import { PostgrestError } from "@supabase/supabase-js";
import { readApiError, toError } from "./api-error";

// Fetch available tracks for an event
export async function fetchEventTracks(
  eventId: string
): Promise<{ data: EventTrack[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("event_tracks")
    .select(`
      track_id,
      event_id,
      name,
      description,
      label,
      scoring_criteria,
      created_at,
      updated_at,
      prizes (
        id,
        prize_amount,
        prize_description
      )
    `)
    .eq("event_id", eventId)
    .order("name");

  return { data: data as EventTrack[] | null, error };
}

// Fetch current tracks for a project
export async function fetchProjectTracks(
  projectId: string
): Promise<{ data: EventTrack[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("project_tracks")
    .select(`
      event_tracks (
        track_id,
        event_id,
        name,
        description,
        label,
        scoring_criteria,
        created_at,
        updated_at,
        prizes (
          id,
          prize_amount,
          prize_description
        )
      )
    `)
    .eq("project_id", projectId);

  if (error) {
    return { data: null, error };
  }

  // Extract the event_tracks from the nested structure and properly type it
  const tracks = data?.flatMap((item: unknown) => (item as { event_tracks: EventTrack[] }).event_tracks).filter(Boolean) || [];
  return { data: tracks, error: null };
}

/**
 * Replace a project's tracks. Writes go through the API, which checks that the
 * caller is on the team or organizes the event, enforces the submission
 * deadline for participants and applies the change atomically.
 */
export async function updateProjectTracks(
  projectId: string,
  trackIds: string[]
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/tracks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds }),
    });
    if (!response.ok) {
      return {
        success: false,
        error: await readApiError(response, "Failed to update project tracks"),
      };
    }
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: toError(error, "Failed to update project tracks"),
    };
  }
}

export type EventTrackAssignment = { projectId: string; trackIds: string[] };

// Matches the API's per-request limit.
const ASSIGNMENT_BATCH_SIZE = 1000;

/**
 * Organizer bulk track assignment for an event.
 * - "add": trackIds are added to each project; existing tracks are kept.
 * - "replace": each listed project ends with exactly its trackIds.
 * Each request is atomic. Lists longer than one request are sent in batches,
 * and a failure stops before the next batch, so `appliedProjects` says how
 * many projects were updated.
 */
export async function assignEventProjectTracks(
  eventId: string,
  mode: "add" | "replace",
  assignments: EventTrackAssignment[]
): Promise<{ success: boolean; error: Error | null; appliedProjects: number }> {
  let appliedProjects = 0;
  for (let i = 0; i < assignments.length; i += ASSIGNMENT_BATCH_SIZE) {
    const batch = assignments.slice(i, i + ASSIGNMENT_BATCH_SIZE);
    try {
      const response = await fetch(`/api/events/${eventId}/project-tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, assignments: batch }),
      });
      if (!response.ok) {
        return {
          success: false,
          error: await readApiError(response, "Failed to assign project tracks"),
          appliedProjects,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: toError(error, "Failed to assign project tracks"),
        appliedProjects,
      };
    }
    appliedProjects += batch.length;
  }
  return { success: true, error: null, appliedProjects };
}
