/**
 * Round-advancement ranking (issue #706, JUDGE-007). Kept separate from
 * rounds.ts because it needs scoring-config.ts, which itself imports rounds.ts.
 */
import type { EventScoringConfig } from "@/lib/types";
import { getTrackScoringConfigForRound } from "@/lib/judging/scoring-config";
import { competitionRanks, computeWeightedScore } from "@/lib/judging/weighted-score";

export interface AdvancementScoreRow {
  project_id: string;
  scores: Record<string, unknown> | null;
  project_name?: string | null;
  lead_name?: string | null;
  judge_id?: string | null;
  track_id?: string | null;
  track_name?: string | null;
}

export interface AdvancementRankingOptions {
  /** Event scoring config (buildEventScoringConfig) used to resolve each row's rubric. */
  scoringConfig: EventScoringConfig | null | undefined;
  /** Round being ranked (rubric overrides are per round). */
  roundNumber: number;
  /**
   * Users who may currently score (judge/organizer/admin). Rows from anyone
   * else (former judges, JUDGE-017) are excluded. null = count everyone.
   */
  activeJudgeIds?: Set<string> | null;
}

export interface AdvancementCandidate {
  projectId: string;
  projectName: string;
  leadName: string;
  score: number | null;
  judgeCount: number;
  /** Competition rank ("1, 2, 2, 4"), same tie rule as the organizer leaderboard. */
  rank: number;
}

/**
 * Ranks projects for round advancement with the same score math as the judge
 * dashboard and organizer leaderboard/CSV (JUDGE-007): each scorecard is
 * computeWeightedScore() against its track's rubric for the round
 * (out-of-range/invalid values ignored), scorecards from former judges and
 * scorecards without a resolvable rubric or valid value are skipped, and a
 * project's score is the mean of its counted scorecards.
 */
export function rankProjectsForAdvancement(
  rows: AdvancementScoreRow[],
  options: AdvancementRankingOptions
): AdvancementCandidate[] {
  const { scoringConfig, roundNumber, activeJudgeIds = null } = options;
  const bucket = new Map<string, { total: number; count: number }>();
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

    if (!row.scores || !row.track_id) continue;
    if (activeJudgeIds && row.judge_id && !activeJudgeIds.has(row.judge_id)) {
      continue;
    }

    const trackConfig = scoringConfig
      ? getTrackScoringConfigForRound({
          scoringConfig,
          trackId: row.track_id,
          roundNumber,
          fallbackTrackName: row.track_name ?? "",
        })
      : undefined;
    if (!trackConfig) continue;

    const { score } = computeWeightedScore(row.scores, trackConfig.criteria);
    if (score === null) continue;

    const existing = bucket.get(row.project_id);
    if (existing) {
      existing.total += score;
      existing.count += 1;
    } else {
      bucket.set(row.project_id, { total: score, count: 1 });
    }
  }

  const ordered = Array.from(bucket.entries())
    .map(([projectId, { total, count }]) => {
      const meta = projectMeta.get(projectId);
      return {
        projectId,
        projectName: meta?.projectName ?? "",
        leadName: meta?.leadName ?? "",
        score: total / count,
        judgeCount: count,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.projectName.localeCompare(b.projectName);
    });

  const ranks = competitionRanks(ordered.map((candidate) => candidate.score));
  return ordered.map((candidate, index) => ({ ...candidate, rank: ranks[index] }));
}
