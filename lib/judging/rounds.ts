/**
 * Multi-round judging helpers (issue #706).
 *
 * Events can optionally configure N judging rounds via
 * `scoring_config.rounds`. When unset, the event behaves as a single round
 * (round 1) with all submitted projects eligible — full backward compat.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventScoringConfig,
  RoundConfig,
} from "@/lib/types";

const DEFAULT_ROUND: RoundConfig = {
  round_number: 1,
  name: "Round 1",
  advancement_count: null,
};

export function getRoundsConfig(
  scoringConfig: EventScoringConfig | null | undefined
): RoundConfig[] {
  const rounds = scoringConfig?.rounds;
  if (!rounds || rounds.length === 0) return [DEFAULT_ROUND];
  // Defensive: ensure ordered by round_number asc.
  return [...rounds].sort((a, b) => a.round_number - b.round_number);
}

export function getActiveRound(
  scoringConfig: EventScoringConfig | null | undefined
): number {
  const active = scoringConfig?.activeRound;
  // Positive integers only — same rule as public.event_active_round (DB).
  if (typeof active === "number" && Number.isInteger(active) && active > 0) {
    return active;
  }
  return 1;
}

/**
 * Returns project_ids eligible for `roundNumber` in this event.
 *
 * Rules:
 *  - If there are advancement rows for the round → return those project_ids.
 *  - If round === 1 and there are no advancement rows → fall back to all
 *    submitted projects (backward compat for single-round events).
 *  - Otherwise → return [] (no one has been advanced to this round yet).
 */
export async function getProjectIdsForRound(
  supabase: SupabaseClient,
  eventId: string,
  roundNumber: number
): Promise<string[]> {
  const { data: advancements, error: advErr } = await supabase
    .from("project_round_advancements")
    .select("project_id")
    .eq("event_id", eventId)
    .eq("round_number", roundNumber);

  if (advErr) throw advErr;

  if (advancements && advancements.length > 0) {
    return (advancements as { project_id: string }[]).map((r) => r.project_id);
  }

  if (roundNumber === 1) {
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id")
      .eq("event_id", eventId)
      .eq("submitted", true);
    if (projErr) throw projErr;
    return (projects as { id: string }[] | null)?.map((p) => p.id) ?? [];
  }

  return [];
}

/**
 * Keeps only the scores given to a project that is eligible for that score's
 * round. Scores are not deleted when a project is dropped from a round, so
 * anything ranking a round has to apply this. A score with no round number
 * belongs to round 1.
 */
export async function filterScoresToRoundEligibleProjects<
  T extends { project_id: string; round_number?: number | null },
>(supabase: SupabaseClient, eventId: string, scores: T[]): Promise<T[]> {
  const roundOf = (score: T) => score.round_number ?? 1;
  const rounds = Array.from(new Set(scores.map(roundOf)));
  const eligibleByRound = new Map(
    await Promise.all(
      rounds.map(
        async (round) =>
          [
            round,
            new Set(await getProjectIdsForRound(supabase, eventId, round)),
          ] as const
      )
    )
  );

  return scores.filter((score) =>
    eligibleByRound.get(roundOf(score))?.has(score.project_id)
  );
}

/**
 * Whether a project is in the event's active round (advanced to it, or
 * submitted for round 1). The project_scores trigger
 * (202611080101 / 202611080105, JUDGE-016) is what enforces this; callers use
 * it to decide whether to offer scoring at all.
 */
export async function isProjectInActiveRound(
  supabase: SupabaseClient,
  { eventId, projectId }: { eventId: string; projectId: string }
): Promise<boolean> {
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("scoring_config")
    .eq("event_id", eventId)
    .maybeSingle();
  if (eventErr) throw eventErr;

  const activeRound = getActiveRound(
    (event?.scoring_config as EventScoringConfig | null) ?? null
  );
  const eligibleProjectIds = await getProjectIdsForRound(
    supabase,
    eventId,
    activeRound
  );
  return eligibleProjectIds.includes(projectId);
}

/**
 * project_scores rows outlive project_tracks membership, so keep only rows
 * whose (project, track) pair is current: a track the project has left must
 * not affect its advancement rank. Unlike the Scores tab's
 * filterScoresToCurrentTracks, an unknown pair is dropped, because
 * currentProjectTracks is the full membership of the projects being ranked.
 */
export function filterScoresToCurrentProjectTracks<
  T extends { project_id: string; track_id: string | null },
>(
  scoreRows: T[],
  currentProjectTracks: Array<{ project_id: string; track_id: string }>
): T[] {
  const trackIdsByProject = new Map<string, Set<string>>();
  for (const { project_id, track_id } of currentProjectTracks) {
    if (!trackIdsByProject.has(project_id)) {
      trackIdsByProject.set(project_id, new Set());
    }
    trackIdsByProject.get(project_id)?.add(track_id);
  }

  return scoreRows.filter(
    (row) =>
      // Legacy rows with no track predate track scoring; they cannot belong to
      // a removed track, so they keep counting as before.
      row.track_id == null ||
      (trackIdsByProject.get(row.project_id)?.has(row.track_id) ?? false)
  );
}

export async function replaceAdvancements(
  supabase: SupabaseClient,
  eventId: string,
  fromRound: number,
  projectIds: string[]
): Promise<{ advanced: string[]; toRound: number }> {
  const toRound = fromRound + 1;
  const advanced = Array.from(
    new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))
  );

  const { error: deleteErr } = await supabase
    .from("project_round_advancements")
    .delete()
    .eq("event_id", eventId)
    .eq("round_number", toRound);
  if (deleteErr) throw deleteErr;

  if (advanced.length === 0) {
    return { advanced: [], toRound };
  }

  const rows = advanced.map((project_id) => ({
    event_id: eventId,
    project_id,
    round_number: toRound,
  }));

  const { error: insertErr } = await supabase
    .from("project_round_advancements")
    .upsert(rows, { onConflict: "event_id,project_id,round_number" });
  if (insertErr) throw insertErr;

  return { advanced, toRound };
}
