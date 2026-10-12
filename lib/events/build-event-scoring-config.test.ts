import { buildEventScoringConfig } from "@/lib/events/build-event-scoring-config";
import type { EventTrack, EventScoringConfig } from "@/lib/types";

describe("buildEventScoringConfig", () => {
  it("preserves persisted round settings while rebuilding track criteria from event tracks", () => {
    const persistedConfig: EventScoringConfig = {
      tracks: {
        stale: {
          name: "Stale Track",
          criteria: [],
        },
      },
      defaultMin: 2,
      defaultMax: 7,
      defaultWeight: 3,
      rounds: [
        { round_number: 1, name: "Qualifiers", advancement_count: 5 },
        { round_number: 2, name: "Finals", advancement_count: null },
      ],
      activeRound: 2,
    };

    const eventTracks = [
      {
        track_id: "main",
        event_id: "event-1",
        name: "Main Track",
        description: "Main track",
        scoring_criteria: {
          name: "Main Track",
          criteria: [
            {
              id: "impact",
              name: "Impact",
              description: "Measures impact",
            },
          ],
        },
        created_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
      },
    ] as EventTrack[];

    expect(
      buildEventScoringConfig({
        event_tracks: eventTracks,
        scoring_config: persistedConfig,
      })
    ).toEqual({
      tracks: {
        main: {
          name: "Main Track",
          criteria: [
            {
              id: "impact",
              name: "Impact",
              description: "Measures impact",
              weight: 1,
              min: 1,
              max: 10,
              type: "numeric",
              options: [],
            },
          ],
        },
      },
      defaultMin: 2,
      defaultMax: 7,
      defaultWeight: 3,
      rounds: persistedConfig.rounds,
      activeRound: 2,
    });
  });

  it("hydrates per-round track overrides from event_tracks", () => {
    const persistedConfig: EventScoringConfig = {
      tracks: {
        main: {
          name: "Main Track",
          criteria: [],
        },
      },
      rounds: [
        { round_number: 1, name: "Qualifiers" },
        { round_number: 2, name: "Finals" },
      ],
      activeRound: 2,
    };

    const eventTracks = [
      {
        track_id: "main",
        event_id: "event-1",
        name: "Main Track",
        description: "Main track",
        scoring_criteria: {
          name: "Main Track",
          criteria: [
            {
              id: "impact",
              name: "Impact",
              description: "Measures impact",
            },
          ],
          rounds: {
            "2": {
              name: "Main Track",
              criteria: [
                {
                  id: "demo",
                  name: "Demo",
                  description: "Final-round demo quality",
                  weight: 2,
                  min: 1,
                  max: 5,
                  type: "numeric",
                  options: [],
                },
              ],
            },
          },
        },
        created_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
      },
    ] as EventTrack[];

    const built = buildEventScoringConfig({
      event_tracks: eventTracks,
      scoring_config: persistedConfig,
    });

    expect(built?.rounds?.[1].tracks).toEqual({
      main: {
        name: "Main Track",
        criteria: [
          {
            id: "demo",
            name: "Demo",
            description: "Final-round demo quality",
            weight: 2,
            min: 1,
            max: 5,
            type: "numeric",
            options: [],
          },
        ],
      },
    });
  });

  it("falls back to the persisted track config when event tracks are unavailable", () => {
    const persistedConfig: EventScoringConfig = {
      tracks: {
        main: {
          name: "Main Track",
          criteria: [
            {
              id: "impact",
              name: "Impact",
              description: "Measures impact",
              weight: 2,
              min: 1,
              max: 5,
              type: "numeric",
              options: [],
            },
          ],
        },
      },
      activeRound: 1,
    };

    expect(
      buildEventScoringConfig({
        event_tracks: null,
        scoring_config: persistedConfig,
      })
    ).toEqual({
      tracks: persistedConfig.tracks,
      defaultMin: 1,
      defaultMax: 10,
      defaultWeight: 1,
      rounds: undefined,
      activeRound: 1,
    });
  });

  it("returns null when no persisted config or event tracks exist", () => {
    expect(
      buildEventScoringConfig({
        event_tracks: [],
        scoring_config: null,
      })
    ).toBeNull();
  });
});
