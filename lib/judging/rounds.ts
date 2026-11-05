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
  ScoringCriterion,
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
  if (typeof active === "number" && active > 0) return active;
  return 1;
}

export interface AdvancementScoreRow {
  project_id: string;
  track_id: string | null;
  judge_id: string;
  scores: Record<string, unknown> | null;
  /** The rubric this row was scored against, for its track and round. */
  criteria: ScoringCriterion[] | null | undefined;
  project_name?: string | null;
  lead_name?: string | null;
}

export interface AdvancementCandidate {
  projectId: string;
  projectName: string;
  leadName: string;
  score: number | null;
  judgeCount: number;
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
 * The number an answer contributes to a total, or null if it contributes
 * nothing: multiple-choice answers never count, even numeric-looking ones, and
 * neither do blank numeric answers.
 */
export function getNumericCriterionScore(
  criterion: ScoringCriterion,
  value: unknown
): number | null {
  if (criterion.type === "multiplechoice") return null;

  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function getWeightedRowTotal(
  scores: Record<string, unknown>,
  criteria: ScoringCriterion[]
): number | null {
  let total = 0;
  let hasNumericScore = false;

  for (const criterion of criteria) {
    const numeric = getNumericCriterionScore(criterion, scores[criterion.id]);
    if (numeric === null) continue;
    total += numeric * (criterion.weight || 1);
    hasNumericScore = true;
  }

  return hasNumericScore ? total : null;
}

/**
 * Ranks projects with the scores table's number: within a track, the mean of
 * each judge's weighted total. A project in several tracks gets the mean of its
 * per-track values, so a track with more judges does not outweigh the others.
 * Rows with no usable numeric answer are left out of the score and judge count.
 */
export function rankProjectsForAdvancement(
  rows: AdvancementScoreRow[]
): AdvancementCandidate[] {
  const bucket = new Map<
    string,
    {
      tracks: Map<string | null, { total: number; count: number }>;
      judgeIds: Set<string>;
    }
  >();
  const projectMeta = new Map<
    string,
    { projectName: string; leadName: string }
  >();

  for (const row of rows) {
    if (!projectMeta.has(row.project_id)) {
      projectMeta.set(row.project_id, {
        projectName: row.project_name ?? "",
        leadName: row.lead_name ?? "",
      });
    }

    if (!row.scores || !row.criteria) continue;
    const rowTotal = getWeightedRowTotal(row.scores, row.criteria);
    if (rowTotal === null) continue;

    let project = bucket.get(row.project_id);
    if (!project) {
      project = { tracks: new Map(), judgeIds: new Set() };
      bucket.set(row.project_id, project);
    }
    project.judgeIds.add(row.judge_id);

    const track = project.tracks.get(row.track_id);
    if (track) {
      track.total += rowTotal;
      track.count += 1;
    } else {
      project.tracks.set(row.track_id, { total: rowTotal, count: 1 });
    }
  }

  return Array.from(bucket.entries())
    .map(([projectId, { tracks, judgeIds }]) => {
      const meta = projectMeta.get(projectId);
      const trackMeans = Array.from(tracks.values()).map(
        ({ total, count }) => total / count
      );
      return {
        projectId,
        projectName: meta?.projectName ?? "",
        leadName: meta?.leadName ?? "",
        score:
          trackMeans.reduce((sum, mean) => sum + mean, 0) / trackMeans.length,
        judgeCount: judgeIds.size,
      };
    })
    .sort((a, b) => {
      if ((b.score ?? -Infinity) !== (a.score ?? -Infinity)) {
        return (b.score ?? -Infinity) - (a.score ?? -Infinity);
      }
      return a.projectName.localeCompare(b.projectName);
    });
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
