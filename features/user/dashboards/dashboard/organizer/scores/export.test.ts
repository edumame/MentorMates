import type { EventScoringConfig } from "@/lib/types";
import {
  buildTrackScores,
  buildRawScoreExportFiles,
  buildRawScoreExportRows,
  buildScoreExportFiles,
  buildScoreExportRows,
  buildTrackScoresByRound,
  type DashboardProjectScore,
  type RawScoreExportData,
} from "./export";

describe("score exports", () => {
  const scoringConfig: EventScoringConfig = {
    tracks: {
      main: {
        name: "Main Track",
        criteria: [
          {
            id: "impact",
            name: "Impact",
            description: "Impact score",
            weight: 2,
            min: 1,
            max: 10,
            type: "numeric",
            options: [],
          },
          {
            id: "feasible",
            name: "Feasibility",
            description: "Feasibility score",
            weight: 1,
            min: 1,
            max: 10,
            type: "numeric",
            options: [],
          },
        ],
      },
    },
    defaultMin: 1,
    defaultMax: 10,
    defaultWeight: 1,
  };
  const multiRoundScoringConfig: EventScoringConfig = {
    ...scoringConfig,
    rounds: [
      {
        round_number: 1,
        name: "Qualifiers",
      },
      {
        round_number: 2,
        name: "Finals",
        tracks: {
          main: {
            name: "Main Track",
            criteria: [
              {
                id: "demo",
                name: "Demo Quality",
                description: "Final round demo",
                weight: 3,
                min: 1,
                max: 5,
                type: "numeric",
                options: [],
              },
            ],
          },
        },
      },
    ],
  };
  const scoringConfigWithChoice: EventScoringConfig = {
    tracks: {
      main: {
        name: "Main Track",
        criteria: [
          {
            id: "impact",
            name: "Impact",
            description: "Impact score",
            weight: 2,
            min: 1,
            max: 10,
            type: "numeric",
            options: [],
          },
          {
            id: "award_fit",
            name: "Award Fit",
            description: "Best fitting award",
            weight: 1,
            min: 1,
            max: 1,
            type: "multiplechoice",
            options: ["Best AI", "Best UX"],
          },
        ],
      },
    },
    defaultMin: 1,
    defaultMax: 10,
    defaultWeight: 1,
  };

  it("keeps track rankings separate for each round", () => {
    const scoreData: DashboardProjectScore[] = [
      {
        project_id: "p1",
        track_id: "main",
        event_id: "event-1",
        round_number: 1,
        scores: { impact: 9, feasible: 6 },
        projects: {
          project_name: "Alpha",
          lead_name: "Alice",
          event_id: "event-1",
        },
        tracks: {
          name: "Main Track",
        },
      },
      {
        project_id: "p2",
        track_id: "main",
        event_id: "event-1",
        round_number: 1,
        scores: { impact: 7, feasible: 8 },
        projects: {
          project_name: "Beta",
          lead_name: "Bob",
          event_id: "event-1",
        },
        tracks: {
          name: "Main Track",
        },
      },
      {
        project_id: "p2",
        track_id: "main",
        event_id: "event-1",
        round_number: 2,
        scores: { impact: 10, feasible: 9 },
        projects: {
          project_name: "Beta",
          lead_name: "Bob",
          event_id: "event-1",
        },
        tracks: {
          name: "Main Track",
        },
      },
      {
        project_id: "p1",
        track_id: "main",
        event_id: "event-1",
        round_number: 2,
        scores: { impact: 8, feasible: 8 },
        projects: {
          project_name: "Alpha",
          lead_name: "Alice",
          event_id: "event-1",
        },
        tracks: {
          name: "Main Track",
        },
      },
    ];

    const byRound = buildTrackScoresByRound(scoreData, scoringConfig);

    expect(byRound[1].main.map((score) => score.projectId)).toEqual([
      "p1",
      "p2",
    ]);
    expect(byRound[2].main.map((score) => score.projectId)).toEqual([
      "p2",
      "p1",
    ]);
  });

  it("includes a per-judge score breakdown for each ranked project", () => {
    const trackScores = buildTrackScores(
      [
        {
          project_id: "p1",
          track_id: "main",
          event_id: "event-1",
          round_number: 1,
          judge_id: "judge-b",
          judge_name: "Zara Judge",
          created_at: "2026-04-01T10:00:00.000Z",
          scores: { impact: 8, feasible: 7 },
          projects: {
            project_name: "Alpha",
            lead_name: "Alice",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
        {
          project_id: "p1",
          track_id: "main",
          event_id: "event-1",
          round_number: 1,
          judge_id: "judge-a",
          judge_name: "Alex Judge",
          created_at: "2026-04-01T09:00:00.000Z",
          scores: { impact: 9, feasible: 6 },
          projects: {
            project_name: "Alpha",
            lead_name: "Alice",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
      ],
      scoringConfig
    );

    expect(trackScores.main[0].judgeScores).toEqual([
      {
        judgeId: "judge-a",
        judgeName: "Alex Judge",
        totalScore: 24,
        submittedAt: "2026-04-01T09:00:00.000Z",
        choiceAnswers: {},
      },
      {
        judgeId: "judge-b",
        judgeName: "Zara Judge",
        totalScore: 23,
        submittedAt: "2026-04-01T10:00:00.000Z",
        choiceAnswers: {},
      },
    ]);
  });

  it("stores each judge's multiple-choice answers in the breakdown", () => {
    const trackScores = buildTrackScores(
      [
        {
          project_id: "p1",
          track_id: "main",
          event_id: "event-1",
          round_number: 1,
          judge_id: "judge-a",
          judge_name: "Alex Judge",
          created_at: "2026-04-01T09:00:00.000Z",
          scores: { impact: 9, award_fit: "Best AI" },
          projects: {
            project_name: "Alpha",
            lead_name: "Alice",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
      ],
      scoringConfigWithChoice
    );

    expect(trackScores.main[0].judgeScores).toEqual([
      {
        judgeId: "judge-a",
        judgeName: "Alex Judge",
        totalScore: 18,
        submittedAt: "2026-04-01T09:00:00.000Z",
        choiceAnswers: {
          award_fit: "Best AI",
        },
      },
    ]);
  });

  it("adds a round column to exported leaderboard rows", () => {
    const byRound = buildTrackScoresByRound(
      [
        {
          project_id: "p2",
          track_id: "main",
          event_id: "event-1",
          round_number: 2,
          scores: { impact: 10, feasible: 9 },
          projects: {
            project_name: "Beta",
            lead_name: "Bob",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
      ],
      scoringConfig
    );

    expect(
      buildScoreExportRows({
        roundNumber: 2,
        scores: byRound[2].main,
        numericCriteria: scoringConfig.tracks.main.criteria.filter(
          (criterion) => criterion.type !== "multiplechoice"
        ),
        choiceCriteria: [],
      })
    ).toEqual([
      {
        Round: 2,
        Rank: 1,
        Project: "Beta",
        Lead: "Bob",
        "Total Average": "29.00",
        "Impact (×2)": "10.00",
        Feasibility: "9.00",
        Judges: 1,
      },
    ]);
  });

  it("builds a separate export file for each round using that round's rubric", () => {
    const exportFiles = buildScoreExportFiles({
      scoreData: [
        {
          project_id: "p1",
          track_id: "main",
          event_id: "event-1",
          round_number: 1,
          scores: { impact: 9, feasible: 6 },
          projects: {
            project_name: "Alpha",
            lead_name: "Alice",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
        {
          project_id: "p2",
          track_id: "main",
          event_id: "event-1",
          round_number: 2,
          scores: { demo: 5 },
          projects: {
            project_name: "Beta",
            lead_name: "Bob",
            event_id: "event-1",
          },
          tracks: {
            name: "Main Track",
          },
        },
      ],
      scoringConfig: multiRoundScoringConfig,
      eventTracks: [
        {
          track_id: "main",
          name: "Main Track",
          project_tracks: [{ project_id: "p1" }, { project_id: "p2" }],
        },
      ],
      eventId: "event-1",
    });

    expect(exportFiles.map((file) => file.fileName)).toEqual([
      "scores-Main_Track-round-1-event-1.csv",
      "scores-Main_Track-round-2-event-1.csv",
    ]);
    expect(Object.keys(exportFiles[0].rows[0])).toEqual([
      "Round",
      "Rank",
      "Project",
      "Lead",
      "Total Average",
      "Impact (×2)",
      "Feasibility",
      "Judges",
    ]);
    expect(Object.keys(exportFiles[1].rows[0])).toEqual([
      "Round",
      "Rank",
      "Project",
      "Lead",
      "Total Average",
      "Demo Quality (×3)",
      "Judges",
    ]);
  });

  it("builds separate raw export files per round and preserves comments", () => {
    const rawScoreData: RawScoreExportData[] = [
      {
        scores: { impact: 9, feasible: 6 },
        comments: "Strong prototype",
        round_number: 1,
        projects: {
          project_name: "Alpha",
          lead_email: "alpha@example.com",
        },
        event_tracks: {
          name: "Main Track",
          track_id: "main",
        },
      },
      {
        scores: { demo: 5 },
        comments: "Best live demo",
        round_number: 2,
        projects: {
          project_name: "Beta",
          lead_email: "beta@example.com",
        },
        event_tracks: {
          name: "Main Track",
          track_id: "main",
        },
      },
    ];

    const files = buildRawScoreExportFiles({
      rawScoreData,
      scoringConfig: multiRoundScoringConfig,
      eventId: "event-1",
    });

    expect(files.map((file) => file.fileName)).toEqual([
      "raw-scores-Main_Track-round-1-event-1.csv",
      "raw-scores-Main_Track-round-2-event-1.csv",
    ]);
    expect(files[0].rows).toEqual([
      {
        "Project Name": "Alpha",
        Track: "Main Track",
        Round: 1,
        Comments: "Strong prototype",
        "Lead Email": "alpha@example.com",
        Impact: 9,
        Feasibility: 6,
      },
    ]);
    expect(files[1].rows).toEqual([
      {
        "Project Name": "Beta",
        Track: "Main Track",
        Round: 2,
        Comments: "Best live demo",
        "Lead Email": "beta@example.com",
        "Demo Quality": 5,
      },
    ]);
  });

  it("falls back to raw criterion ids when no rubric config is found", () => {
    expect(
      buildRawScoreExportRows({
        scoreData: [
          {
            scores: { custom_metric: 7 },
            comments: "Unmapped metric",
            round_number: 3,
            projects: {
              project_name: "Gamma",
              lead_email: "gamma@example.com",
            },
            event_tracks: {
              name: "Unknown Track",
              track_id: "unknown",
            },
          },
        ],
        scoringConfig,
      })
    ).toEqual([
      {
        "Project Name": "Gamma",
        Track: "Unknown Track",
        Round: 3,
        Comments: "Unmapped metric",
        "Lead Email": "gamma@example.com",
        Score_custom_metric: 7,
      },
    ]);
  });
});
