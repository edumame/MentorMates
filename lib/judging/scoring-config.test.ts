import type { EventScoringConfig, EventTrackScoringConfig } from "@/lib/types";
import { getTrackScoringConfigForRound } from "@/lib/judging/scoring-config";

describe("getTrackScoringConfigForRound", () => {
  const baseConfig: EventScoringConfig = {
    tracks: {
      main: {
        name: "Main Track",
        criteria: [
          {
            id: "impact",
            name: "Impact",
            description: "Base impact",
            weight: 1,
            min: 1,
            max: 10,
            type: "numeric",
            options: [],
          },
        ],
      },
    },
    rounds: [
      {
        round_number: 1,
        name: "Round 1",
      },
      {
        round_number: 2,
        name: "Round 2",
      },
    ],
    activeRound: 2,
  };
  const trackScoringCriteria: EventTrackScoringConfig = {
    ...baseConfig.tracks.main,
    rounds: {
      "2": {
        name: "Main Track",
        criteria: [
          {
            id: "demo",
            name: "Demo Quality",
            description: "Round 2 demo",
            weight: 2,
            min: 1,
            max: 5,
            type: "numeric",
            options: [],
          },
        ],
      },
    },
  };

  it("returns the round-specific track config when it exists", () => {
    expect(
      getTrackScoringConfigForRound({
        scoringConfig: baseConfig,
        trackId: "main",
        roundNumber: 2,
        trackScoringCriteria,
      })
    ).toEqual(trackScoringCriteria.rounds?.["2"]);
  });

  it("falls back to the base track config when the round has no override", () => {
    expect(
      getTrackScoringConfigForRound({
        scoringConfig: baseConfig,
        trackId: "main",
        roundNumber: 1,
        trackScoringCriteria,
      })
    ).toEqual(baseConfig.tracks.main);
  });

  it("uses activeRound when roundNumber is omitted", () => {
    expect(
      getTrackScoringConfigForRound({
        scoringConfig: baseConfig,
        trackId: "main",
        trackScoringCriteria,
      })
    ).toEqual(trackScoringCriteria.rounds?.["2"]);
  });
});
