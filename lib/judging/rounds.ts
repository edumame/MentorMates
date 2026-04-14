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
  if (typeof active === "number" && active > 0) return active;
  return 1;
}

export function isMultiRound(
  scoringConfig: EventScoringConfig | null | undefined
): boolean {
  return !!scoringConfig?.rounds && scoringConfig.rounds.length > 1;
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
 * Compute the top-K projects from `fromRound` (by average score across all
 * criteria/tracks) and insert advancement rows for `fromRound + 1`.
 *
 * Returns the list of advanced project_ids (in ranked order).
 */
export async function computeAdvancements(
  supabase: SupabaseClient,
  eventId: string,
  fromRound: number,
  scoringConfig: EventScoringConfig | null | undefined
): Promise<{ advanced: string[]; toRound: number }> {
  const rounds = getRoundsConfig(scoringConfig);
  const current = rounds.find((r) => r.round_number === fromRound);
  const advancementCount = current?.advancement_count ?? null;
  const toRound = fromRound + 1;

  // Pull all scores for this event + round.
  const { data: scores, error: scoreErr } = await supabase
    .from("project_scores")
    .select("project_id, scores")
    .eq("event_id", eventId)
    .eq("round_number", fromRound);
  if (scoreErr) throw scoreErr;

  // Average numeric criteria per project.
  const bucket = new Map<string, { total: number; count: number }>();
  for (const row of (scores ?? []) as {
    project_id: string;
    scores: Record<string, unknown> | null;
  }[]) {
    if (!row.scores) continue;
    let sum = 0;
    let n = 0;
    for (const v of Object.values(row.scores)) {
      const num = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(num)) {
        sum += num;
        n += 1;
      }
    }
    if (n === 0) continue;
    const avg = sum / n;
    const existing = bucket.get(row.project_id);
    if (existing) {
      existing.total += avg;
      existing.count += 1;
    } else {
      bucket.set(row.project_id, { total: avg, count: 1 });
    }
  }

  const ranked = Array.from(bucket.entries())
    .map(([project_id, { total, count }]) => ({
      project_id,
      avg: total / count,
    }))
    .sort((a, b) => b.avg - a.avg);

  const advanced =
    advancementCount && advancementCount > 0
      ? ranked.slice(0, advancementCount).map((r) => r.project_id)
      : ranked.map((r) => r.project_id);

  if (advanced.length === 0) return { advanced: [], toRound };

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
