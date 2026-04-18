import type { EventScoringConfig, ScoringCriterion } from "@/lib/types";
import { getTrackScoringConfigForRound } from "@/lib/judging/scoring-config";

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
  totalScore: number;
  submittedAt: string | null;
  choiceAnswers: Record<string, string>;
}

export interface TrackScore {
  projectId: string;
  projectName: string;
  leadName: string;
  averageScore: number;
  totalScore: number;
  numberOfJudges: number;
  criterionScores: Record<string, { total: number; average: number }>;
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
  scoringConfig: EventScoringConfig
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

  let totalScore = 0;

  Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
    const criterion = trackConfig.criteria.find(
      (item: ScoringCriterion) => item.id === criterionId
    );
    if (!criterion) return;

    if (criterion.type === "multiplechoice") {
      const value = String(scoreValue);
      if (!projectScore.choiceCounts) projectScore.choiceCounts = {};
      if (!projectScore.choiceCounts[criterionId]) {
        projectScore.choiceCounts[criterionId] = {};
      }
      const counts = projectScore.choiceCounts[criterionId];
      counts[value] = (counts[value] || 0) + 1;
      return;
    }

    const numeric =
      typeof scoreValue === "number"
        ? scoreValue
        : parseFloat(String(scoreValue));

    if (Number.isNaN(numeric)) return;

    totalScore += numeric * (criterion.weight || 1);

    if (!projectScore.criterionScores[criterionId]) {
      projectScore.criterionScores[criterionId] = {
        total: 0,
        average: 0,
      };
    }

    projectScore.criterionScores[criterionId].total += numeric;
  });

  projectScore.totalScore += totalScore;
  projectScore.numberOfJudges += 1;
  projectScore.averageScore =
    projectScore.totalScore / projectScore.numberOfJudges;

  const judgeKey =
    score.judge_id?.trim() ||
    score.judge_name?.trim() ||
    `judge-${projectScore.numberOfJudges}`;
  const judgeName = score.judge_name?.trim() || score.judge_id?.trim() || judgeKey;
  const existingJudgeScore = projectScore.judgeScores.find(
    (judgeScore) => judgeScore.judgeId === judgeKey
  );

  if (existingJudgeScore) {
    existingJudgeScore.judgeName = judgeName;
    existingJudgeScore.totalScore = totalScore;
    existingJudgeScore.submittedAt = score.created_at ?? null;
  } else {
    projectScore.judgeScores.push({
      judgeId: judgeKey,
      judgeName,
      totalScore,
      submittedAt: score.created_at ?? null,
      choiceAnswers: {},
    });
  }

  Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
    const criterion = trackConfig.criteria.find(
      (item: ScoringCriterion) => item.id === criterionId
    );
    if (!criterion || criterion.type !== "multiplechoice") {
      return;
    }

    const judgeScore = projectScore.judgeScores.find(
      (item) => item.judgeId === judgeKey
    );
    if (!judgeScore) {
      return;
    }

    judgeScore.choiceAnswers[criterionId] = String(scoreValue);
  });

  Object.keys(projectScore.criterionScores).forEach((criterionId) => {
    projectScore.criterionScores[criterionId].average =
      projectScore.criterionScores[criterionId].total /
      projectScore.numberOfJudges;
  });
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
  scoringConfig: EventScoringConfig
): TrackScores {
  if (!scoreData.length) {
    return {};
  }

  const trackScoresMap: TrackScores = {};

  scoreData.forEach((score) => {
    addProjectScore(trackScoresMap, score, scoringConfig);
  });

  return sortTrackScores(trackScoresMap);
}

export function buildTrackScoresByRound(
  scoreData: DashboardProjectScore[],
  scoringConfig: EventScoringConfig
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

    addProjectScore(trackScoresByRound[roundNumber], score, scoringConfig);
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

  return scores.map((score, index) => {
    const row: Record<string, string | number> = {
      Round: roundNumber,
      Rank: index + 1,
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
}) {
  const { scoreData, scoringConfig } = params;

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
      Comments: score.comments || "",
      "Lead Email": score.projects.lead_email || "",
    };

    if (score.scores && trackConfig) {
      Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
        const criterion = trackConfig.criteria.find((item) => item.id === criterionId);
        const criterionName = criterion ? criterion.name : criterionId;
        baseData[criterionName] = scoreValue as string | number | null;
      });
    } else if (score.scores) {
      Object.entries(score.scores).forEach(([criterionId, scoreValue]) => {
        baseData[`Score_${criterionId}`] = scoreValue as
          | string
          | number
          | null;
      });
    }

    return baseData;
  });
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
}): ScoreExportFile[] {
  const {
    scoreData,
    scoringConfig,
    eventTracks,
    eventId,
    linkTracksEnabled = false,
    mainTrackId = null,
  } = params;

  const trackScoresByRound = buildTrackScoresByRound(scoreData, scoringConfig);
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
}): ScoreExportFile[] {
  const { rawScoreData, scoringConfig, eventId } = params;

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
          }),
        })
      )
    );
}
