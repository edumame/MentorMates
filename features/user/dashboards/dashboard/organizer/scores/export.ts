import type { EventScoringConfig, ScoringCriterion } from "@/lib/types";
import { getTrackScoringConfigForRound } from "@/lib/judging/scoring-config";
import {
  competitionRanks,
  computeWeightedScore,
  isNumericCriterion,
} from "@/lib/judging/weighted-score";

export interface DashboardProjectScore {
  project_id: string;
  track_id: string;
  event_id: string;
  round_number: number;
  judge_id?: string | null;
  judge_name?: string | null;
  created_at?: string | null;
  scores: Record<string, number | string>;
  projects: {
    project_name: string;
    lead_name: string;
    event_id: string;
  };
  tracks: {
    name: string;
  };
}

export interface RawScoreExportData {
  scores: Record<string, string | number>;
  comments: string | null;
  round_number: number;
  judge_id?: string | null;
  judge_name?: string | null;
  created_at?: string | null;
  projects: {
    project_name: string;
    lead_email: string;
  };
  event_tracks: {
    name: string;
    track_id?: string;
  };
}

export interface JudgeScoreSummary {
  judgeId: string;
  judgeName: string;
  /** This judge's weighted score (shared formula, lib/judging/weighted-score). */
  totalScore: number;
  submittedAt: string | null;
  choiceAnswers: Record<string, string>;
  /**
   * Why this judge's row does not count toward the averages:
   * "former_judge" (no longer a judge/organizer of the event) or
   * "incomplete" (a weighted criterion is unanswered, out of range or not
   * numeric; see lib/judging/weighted-score).
   */
  excludedReason?: "former_judge" | "incomplete";
  /** Criteria whose stored value was outside the rubric range or not numeric. */
  invalidCriterionIds?: string[];
  /** Weighted criteria the judge left unanswered. */
  missingCriterionIds?: string[];
}

export interface BuildTrackScoresOptions {
  /**
   * User ids who currently hold a scoring role for the event. When given,
   * scores from anyone else are listed but excluded from averages (JUDGE-017).
   */
  activeJudgeIds?: Set<string> | null;
}

export interface TrackScore {
  projectId: string;
  projectName: string;
  leadName: string;
  averageScore: number;
  totalScore: number;
  numberOfJudges: number;
  criterionScores: Record<string, { total: number; average: number; count: number }>;
  judgeScores: JudgeScoreSummary[];
  choiceCounts?: Record<string, Record<string, number>>;
}

export interface TrackScores {
  [trackId: string]: TrackScore[];
}

export interface TrackScoresByRound {
  [roundNumber: number]: TrackScores;
}

export interface ExportTrackMeta {
  track_id: string;
  name: string;
  project_tracks?: Array<{ project_id: string }> | null;
}

export interface ScoreExportFile {
  roundNumber: number;
  trackId: string;
  trackName: string;
  fileName: string;
  rows: Array<Record<string, string | number | null>>;
}

/**
 * project_scores rows outlive project_tracks membership, so drop rows for a
 * track the project has left: they must not rank there. The rows themselves
 * stay in the database and reappear if the project rejoins the track. Scores
 * are kept when the track's membership is unknown.
 */
export function filterScoresToCurrentTracks<
  T extends { project_id: string; track_id: string },
>(scoreData: T[], eventTracks: ExportTrackMeta[]): T[] {
  const projectIdsByTrack = new Map(
    eventTracks
      .filter((track) => track.project_tracks)
      .map((track) => [
        track.track_id,
        new Set(track.project_tracks?.map((row) => row.project_id)),
      ])
  );

  return scoreData.filter(
    (score) =>
      projectIdsByTrack.get(score.track_id)?.has(score.project_id) ?? true
  );
}

function getTrackConfig(
  scoringConfig: EventScoringConfig,
  trackId: string,
  trackName: string,
  roundNumber: number
) {
  return getTrackScoringConfigForRound({
    scoringConfig,
    trackId,
    roundNumber,
    fallbackTrackName: trackName,
  });
}

function addProjectScore(
  trackScoresMap: TrackScores,
  score: DashboardProjectScore,
  scoringConfig: EventScoringConfig,
  options: BuildTrackScoresOptions = {}
) {
  if (!trackScoresMap[score.track_id]) {
    trackScoresMap[score.track_id] = [];
  }

  let projectScore = trackScoresMap[score.track_id].find(
    (project) => project.projectId === score.project_id
  );

  if (!projectScore) {
    projectScore = {
      projectId: score.project_id,
      projectName: score.projects.project_name,
      leadName: score.projects.lead_name,
      averageScore: 0,
      totalScore: 0,
      numberOfJudges: 0,
      criterionScores: {},
      judgeScores: [],
    };
    trackScoresMap[score.track_id].push(projectScore);
  }

  const trackConfig = getTrackConfig(
    scoringConfig,
    score.track_id,
    score.tracks?.name || "",
    score.round_number
  );

  if (!trackConfig || !score.scores || Object.keys(score.scores).length === 0) {
    return;
  }

  const judgeKey =
    score.judge_id?.trim() ||
    score.judge_name?.trim() ||
    `judge-${projectScore.judgeScores.length + 1}`;
  const judgeName = score.judge_name?.trim() || score.judge_id?.trim() || judgeKey;
  const isFormerJudge =
    !!options.activeJudgeIds &&
    !!score.judge_id &&
    !options.activeJudgeIds.has(score.judge_id);

  // One formula everywhere (JUDGE-007): weight-normalised mean of valid values.
  const weighted = computeWeightedScore(score.scores, trackConfig.criteria);
  const excludedReason: JudgeScoreSummary["excludedReason"] = isFormerJudge
    ? "former_judge"
    : weighted.score === null
      ? "incomplete"
      : undefined;

  const choiceAnswers: Record<string, string> = {};
  for (const criterion of trackConfig.criteria) {
    if (isNumericCriterion(criterion)) continue;
    const value = score.scores[criterion.id];
    if (value === undefined || value === null || value === "") continue;
    choiceAnswers[criterion.id] = String(value);
    if (excludedReason === "former_judge") continue;
    if (!projectScore.choiceCounts) projectScore.choiceCounts = {};
    const counts = (projectScore.choiceCounts[criterion.id] ??= {});
    counts[String(value)] = (counts[String(value)] || 0) + 1;
  }

  const summary: JudgeScoreSummary = {
    judgeId: judgeKey,
    judgeName,
    totalScore: weighted.score ?? 0,
    submittedAt: score.created_at ?? null,
    choiceAnswers,
    ...(excludedReason ? { excludedReason } : {}),
    ...(weighted.invalidCriterionIds.length
      ? { invalidCriterionIds: weighted.invalidCriterionIds }
      : {}),
    ...(weighted.missingCriterionIds.length
      ? { missingCriterionIds: weighted.missingCriterionIds }
      : {}),
  };
  const existingIndex = projectScore.judgeScores.findIndex(
    (judgeScore) => judgeScore.judgeId === judgeKey
  );
  if (existingIndex >= 0) {
    projectScore.judgeScores[existingIndex] = summary;
  } else {
    projectScore.judgeScores.push(summary);
  }

  if (!excludedReason) {
    for (const [criterionId, value] of Object.entries(weighted.validValues)) {
      const entry = (projectScore.criterionScores[criterionId] ??= {
        total: 0,
        average: 0,
        count: 0,
      });
      entry.total += value;
      entry.count += 1;
      entry.average = entry.total / entry.count;
    }
  }

  recomputeProjectTotals(projectScore);
}

function recomputeProjectTotals(projectScore: TrackScore) {
  const counted = projectScore.judgeScores.filter((judge) => !judge.excludedReason);
  projectScore.numberOfJudges = counted.length;
  projectScore.totalScore = counted.reduce((sum, judge) => sum + judge.totalScore, 0);
  projectScore.averageScore = counted.length > 0 ? projectScore.totalScore / counted.length : 0;
}

function sortTrackScores(trackScoresMap: TrackScores) {
  Object.keys(trackScoresMap).forEach((trackId) => {
    trackScoresMap[trackId].forEach((projectScore) => {
      projectScore.judgeScores.sort((a, b) => {
        const byName = a.judgeName.localeCompare(b.judgeName);
        if (byName !== 0) {
          return byName;
        }

        return b.totalScore - a.totalScore;
      });
    });

    trackScoresMap[trackId].sort((a, b) => b.averageScore - a.averageScore);
  });

  return trackScoresMap;
}

export function buildTrackScores(
  scoreData: DashboardProjectScore[],
  scoringConfig: EventScoringConfig,
  options: BuildTrackScoresOptions = {}
): TrackScores {
  if (!scoreData.length) {
    return {};
  }

  const trackScoresMap: TrackScores = {};

  scoreData.forEach((score) => {
    addProjectScore(trackScoresMap, score, scoringConfig, options);
  });

  return sortTrackScores(trackScoresMap);
}

export function buildTrackScoresByRound(
  scoreData: DashboardProjectScore[],
  scoringConfig: EventScoringConfig,
  options: BuildTrackScoresOptions = {}
): TrackScoresByRound {
  if (!scoreData.length) {
    return {};
  }

  const trackScoresByRound: TrackScoresByRound = {};

  scoreData.forEach((score) => {
    const roundNumber = score.round_number > 0 ? score.round_number : 1;
    if (!trackScoresByRound[roundNumber]) {
      trackScoresByRound[roundNumber] = {};
    }

    addProjectScore(trackScoresByRound[roundNumber], score, scoringConfig, options);
  });

  Object.keys(trackScoresByRound).forEach((roundKey) => {
    const roundNumber = Number(roundKey);
    trackScoresByRound[roundNumber] = sortTrackScores(
      trackScoresByRound[roundNumber]
    );
  });

  return trackScoresByRound;
}

export function buildScoreExportRows(params: {
  roundNumber: number;
  scores: TrackScore[];
  numericCriteria: ScoringCriterion[];
  choiceCriteria: ScoringCriterion[];
}) {
  const { roundNumber, scores, numericCriteria, choiceCriteria } = params;
  const ranks = getRanksByProjectId(scores);

  return scores.map((score, index) => {
    const row: Record<string, string | number> = {
      Round: roundNumber,
      Rank: ranks.get(score.projectId) ?? index + 1,
      Project: score.projectName,
      Lead: score.leadName,
      "Total Average": score.averageScore.toFixed(2),
    };

    numericCriteria.forEach((criterion) => {
      const criterionScore = score.criterionScores[criterion.id];
      const columnName =
        criterion.weight && criterion.weight !== 1
          ? `${criterion.name} (×${criterion.weight})`
          : criterion.name;
      row[columnName] = criterionScore
        ? criterionScore.average.toFixed(2)
        : "—";
    });

    choiceCriteria.forEach((criterion) => {
      const counts = score.choiceCounts?.[criterion.id] || {};
      row[criterion.name] = (criterion.options || [])
        .map((option) => `${option}: ${counts[option] || 0}`)
        .join(", ") || "—";
    });

    row["Judges"] = score.numberOfJudges;

    return row;
  });
}

export function buildRawScoreExportRows(params: {
  scoreData: RawScoreExportData[];
  scoringConfig: EventScoringConfig;
  activeJudgeIds?: Set<string> | null;
}) {
  const { scoreData, scoringConfig, activeJudgeIds } = params;

  return scoreData.map((score) => {
    const trackName = score.event_tracks.name || "";
    const trackConfig = getTrackConfig(
      scoringConfig,
      score.event_tracks.track_id || "",
      trackName,
      score.round_number
    );
    const baseData: Record<string, string | number | null> = {
      "Project Name": score.projects.project_name || "",
      Track: score.event_tracks.name || "",
      Round: score.round_number ?? 1,
      "Judge Name": score.judge_name || "",
      "Judge ID": score.judge_id || "",
      "Submitted At": score.created_at || "",
      Comments: score.comments || "",
      "Lead Email": score.projects.lead_email || "",
    };

    let weightedScore: number | null = null;
    let invalidCriterionIds: string[] = [];
    let missingCriterionIds: string[] = [];
    if (score.scores && trackConfig) {
      Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
        const criterion = trackConfig.criteria.find((item) => item.id === criterionId);
        const criterionName = criterion ? criterion.name : criterionId;
        baseData[criterionName] = scoreValue as string | number | null;
      });
      const weighted = computeWeightedScore(score.scores, trackConfig.criteria);
      weightedScore = weighted.score;
      invalidCriterionIds = weighted.invalidCriterionIds;
      missingCriterionIds = weighted.missingCriterionIds;
    } else if (score.scores) {
      Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
        baseData[`Score_${criterionId}`] = scoreValue as
          | string
          | number
          | null;
      });
    }

    const isFormerJudge =
      !!activeJudgeIds && !!score.judge_id && !activeJudgeIds.has(score.judge_id);
    const notes: string[] = [];
    if (isFormerJudge) notes.push("Former judge (excluded from rankings)");
    if (invalidCriterionIds.length > 0 && trackConfig) {
      const names = invalidCriterionIds.map(
        (id) => trackConfig.criteria.find((item) => item.id === id)?.name || id
      );
      notes.push(`Out-of-range values ignored: ${names.join(", ")}`);
    }
    if (missingCriterionIds.length > 0 && trackConfig) {
      const names = missingCriterionIds.map(
        (id) => trackConfig.criteria.find((item) => item.id === id)?.name || id
      );
      notes.push(`Incomplete, not counted (missing: ${names.join(", ")})`);
    } else if (weightedScore === null && invalidCriterionIds.length > 0) {
      notes.push("Incomplete, not counted");
    }

    // Normalised weighted score on the 0-10 scale (same formula as the leaderboard).
    baseData["Total Score"] =
      weightedScore === null ? null : Number(weightedScore.toFixed(4));
    baseData["Score Notes"] = notes.join("; ");

    return baseData;
  });
}

/**
 * Competition ranks by average score (ties share a rank), independent of how
 * the caller sorted the rows for display.
 */
export function getRanksByProjectId(scores: TrackScore[]): Map<string, number> {
  const ordered = [...scores].sort((a, b) => b.averageScore - a.averageScore);
  const ranks = competitionRanks(ordered.map((score) => score.averageScore));
  return new Map(ordered.map((score, index) => [score.projectId, ranks[index]]));
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

export function buildScoreExportFiles(params: {
  scoreData: DashboardProjectScore[];
  scoringConfig: EventScoringConfig;
  eventTracks: ExportTrackMeta[];
  eventId: string;
  linkTracksEnabled?: boolean;
  mainTrackId?: string | null;
  activeJudgeIds?: Set<string> | null;
}): ScoreExportFile[] {
  const {
    scoreData,
    scoringConfig,
    eventTracks,
    eventId,
    linkTracksEnabled = false,
    mainTrackId = null,
    activeJudgeIds = null,
  } = params;

  const trackScoresByRound = buildTrackScoresByRound(scoreData, scoringConfig, {
    activeJudgeIds,
  });
  const roundsToExport = Object.keys(trackScoresByRound)
    .map(Number)
    .sort((a, b) => a - b);

  if (roundsToExport.length === 0) {
    return [];
  }

  const tracksWithProjects = eventTracks
    .filter((track) => (track.project_tracks || []).length > 0)
    .map((track) => track.track_id);
  const scoredTrackIds = Array.from(
    new Set(scoreData.map((score) => score.track_id))
  );
  const tracksToExport = Array.from(
    new Set([...scoredTrackIds, ...tracksWithProjects])
  );

  return roundsToExport.flatMap((roundNumber) => {
    const roundTrackScores = trackScoresByRound[roundNumber] || {};

    return tracksToExport.flatMap((trackId) => {
      const trackName =
        eventTracks.find((track) => track.track_id === trackId)?.name ||
        Object.values(scoringConfig.tracks).find((track) =>
          trackId.includes(track.name)
        )?.name ||
        trackId;

      const isSubtrack =
        !!linkTracksEnabled && !!mainTrackId && trackId !== mainTrackId;
      const displayTrackId =
        isSubtrack && mainTrackId ? mainTrackId : trackId;

      const roundTrackConfig = getTrackScoringConfigForRound({
        scoringConfig,
        trackId: displayTrackId,
        roundNumber,
        fallbackTrackName: trackName,
      });
      if (!roundTrackConfig) {
        return [];
      }

      const numericCriteria = roundTrackConfig.criteria.filter(
        (criterion) => criterion.type !== "multiplechoice"
      );
      const choiceCriteria = roundTrackConfig.criteria.filter(
        (criterion) => criterion.type === "multiplechoice"
      );

      let displayScores: TrackScore[];

      if (isSubtrack && mainTrackId && roundTrackScores[mainTrackId]) {
        const track = eventTracks.find((eventTrack) => eventTrack.track_id === trackId);
        const subtrackProjectIds = new Set(
          (track?.project_tracks || []).map((projectTrack) => projectTrack.project_id)
        );

        displayScores = roundTrackScores[mainTrackId].filter((mainScore) =>
          subtrackProjectIds.has(mainScore.projectId)
        );
      } else {
        displayScores = roundTrackScores[trackId] || [];
      }

      return [
        {
          roundNumber,
          trackId,
          trackName,
          fileName: `scores-${sanitizeFilePart(trackName)}-round-${roundNumber}-${eventId}.csv`,
          rows: buildScoreExportRows({
            roundNumber,
            scores: displayScores,
            numericCriteria,
            choiceCriteria,
          }),
        },
      ];
    });
  });
}

export function buildRawScoreExportFiles(params: {
  rawScoreData: RawScoreExportData[];
  scoringConfig: EventScoringConfig;
  eventId: string;
  activeJudgeIds?: Set<string> | null;
}): ScoreExportFile[] {
  const { rawScoreData, scoringConfig, eventId, activeJudgeIds = null } = params;

  if (rawScoreData.length === 0) {
    return [];
  }

  const groupedByRoundAndTrack = rawScoreData.reduce<
    Record<number, Record<string, RawScoreExportData[]>>
  >((acc, score) => {
    const roundNumber = score.round_number > 0 ? score.round_number : 1;
    const trackName = score.event_tracks.name || "Unknown Track";

    if (!acc[roundNumber]) {
      acc[roundNumber] = {};
    }

    if (!acc[roundNumber][trackName]) {
      acc[roundNumber][trackName] = [];
    }

    acc[roundNumber][trackName].push(score);
    return acc;
  }, {});

  return Object.keys(groupedByRoundAndTrack)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((roundNumber) =>
      Object.entries(groupedByRoundAndTrack[roundNumber]).map(
        ([trackName, trackData]) => ({
          roundNumber,
          trackId: trackData[0]?.event_tracks.track_id || trackName,
          trackName,
          fileName: `raw-scores-${sanitizeFilePart(trackName)}-round-${roundNumber}-${eventId}.csv`,
          rows: buildRawScoreExportRows({
            scoreData: trackData,
            scoringConfig,
            activeJudgeIds,
          }),
        })
      )
    );
}
