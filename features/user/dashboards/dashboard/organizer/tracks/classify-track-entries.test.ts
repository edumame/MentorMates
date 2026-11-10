import { randomUUID } from "node:crypto";
import {
  classifyTrackEntries,
  rekeyTrackDescriptions,
  withFreshTrackIds,
  withoutTrack,
  withUuidTrackIds,
} from "./classify-track-entries";
import type { EventScoringConfig } from "@/lib/types";

// jsdom's crypto has no randomUUID; the browser code under test relies on it.
Object.defineProperty(globalThis.crypto, "randomUUID", {
  value: randomUUID,
  configurable: true,
});

const REAL_UUID_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const REAL_UUID_B = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
const TIMESTAMP_ID = "track-0-1771372800000";
const SLUG_ID = "track-0-my-track";

const EVENT_ID = "evt-test-123";
const buildEntry = (trackId: string) => ({
  name: `Track ${trackId.slice(0, 8)}`,
  description: `Track ${trackId.slice(0, 8)}`,
  scoring_criteria: { name: "test", criteria: [] },
});

describe("classifyTrackEntries", () => {
  it("classifies a real UUID that exists in DB as existing", () => {
    const result = classifyTrackEntries(
      [REAL_UUID_A],
      new Set([REAL_UUID_A]),
      EVENT_ID,
      buildEntry,
    );
    expect(result.existing).toHaveLength(1);
    expect(result.existing[0].track_id).toBe(REAL_UUID_A);
    expect(result.newTracks).toHaveLength(0);
  });

  it("classifies a timestamp-based ID as new (no track_id set)", () => {
    const result = classifyTrackEntries(
      [TIMESTAMP_ID],
      new Set(),
      EVENT_ID,
      buildEntry,
    );
    expect(result.newTracks).toHaveLength(1);
    expect(result.newTracks[0]).not.toHaveProperty("track_id");
    expect(result.existing).toHaveLength(0);
  });

  it("classifies a slug-based ID as new (no track_id set)", () => {
    const result = classifyTrackEntries(
      [SLUG_ID],
      new Set(),
      EVENT_ID,
      buildEntry,
    );
    expect(result.newTracks).toHaveLength(1);
    expect(result.newTracks[0]).not.toHaveProperty("track_id");
  });

  it("classifies a UUID that does NOT exist in DB as new and keeps it as track_id", () => {
    const result = classifyTrackEntries(
      [REAL_UUID_A],
      new Set([REAL_UUID_B]), // different UUID in DB
      EVENT_ID,
      buildEntry,
    );
    expect(result.newTracks).toHaveLength(1);
    expect(result.newTracks[0].track_id).toBe(REAL_UUID_A);
    expect(result.existing).toHaveLength(0);
  });

  it("handles mixed existing and new tracks", () => {
    const result = classifyTrackEntries(
      [REAL_UUID_A, TIMESTAMP_ID, REAL_UUID_B],
      new Set([REAL_UUID_A, REAL_UUID_B]),
      EVENT_ID,
      buildEntry,
    );
    expect(result.existing).toHaveLength(2);
    expect(result.existing.map((e) => e.track_id)).toEqual([REAL_UUID_A, REAL_UUID_B]);
    expect(result.newTracks).toHaveLength(1);
    expect(result.newTracks[0]).not.toHaveProperty("track_id");
  });

  it("always sets event_id on every entry", () => {
    const result = classifyTrackEntries(
      [REAL_UUID_A, TIMESTAMP_ID],
      new Set([REAL_UUID_A]),
      EVENT_ID,
      buildEntry,
    );
    const allEntries = [...result.existing, ...result.newTracks];
    for (const entry of allEntries) {
      expect(entry.event_id).toBe(EVENT_ID);
    }
  });
});

describe("withUuidTrackIds", () => {
  const track = { name: "Track", criteria: [] };
  const baseConfig: EventScoringConfig = {
    tracks: {},
    defaultMin: 0,
    defaultMax: 10,
    defaultWeight: 1,
  };

  it("returns the same config when every track id is already a UUID", () => {
    const config = { ...baseConfig, tracks: { [REAL_UUID_A]: track } };
    expect(withUuidTrackIds(config)).toBe(config);
  });

  it("re-keys non-UUID tracks and their round overrides to the same new UUID", () => {
    const result = withUuidTrackIds({
      ...baseConfig,
      tracks: { [REAL_UUID_A]: track, [SLUG_ID]: track },
      rounds: [
        { round_number: 1, name: "Qualifiers" },
        { round_number: 2, name: "Finals", tracks: { [SLUG_ID]: track } },
      ],
    });

    const newId = Object.keys(result.tracks).find((id) => id !== REAL_UUID_A);
    expect(Object.keys(result.tracks)).toHaveLength(2);
    expect(newId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.tracks).not.toHaveProperty(SLUG_ID);
    expect(result.rounds?.[0].tracks).toBeUndefined();
    expect(Object.keys(result.rounds?.[1].tracks ?? {})).toEqual([newId]);
  });
});

describe("withoutTrack", () => {
  const track = { name: "Track", criteria: [] };
  const config: EventScoringConfig = {
    tracks: { [REAL_UUID_A]: track, [REAL_UUID_B]: track },
    defaultMin: 0,
    defaultMax: 10,
    defaultWeight: 1,
    rounds: [
      { round_number: 1, name: "Only A", tracks: { [REAL_UUID_A]: track } },
      {
        round_number: 2,
        name: "Both",
        tracks: { [REAL_UUID_A]: track, [REAL_UUID_B]: track },
      },
      { round_number: 3, name: "Only B", tracks: { [REAL_UUID_B]: track } },
    ],
  };

  it("removes the track and its round overrides, leaving the others", () => {
    const result = withoutTrack(config, REAL_UUID_A);

    expect(Object.keys(result.tracks)).toEqual([REAL_UUID_B]);
    expect(result.rounds?.[0].tracks).toBeUndefined();
    expect(Object.keys(result.rounds?.[1].tracks ?? {})).toEqual([REAL_UUID_B]);
    expect(result.rounds?.[2]).toBe(config.rounds?.[2]);
  });

  it("does not mutate the original config", () => {
    withoutTrack(config, REAL_UUID_A);

    expect(Object.keys(config.tracks)).toEqual([REAL_UUID_A, REAL_UUID_B]);
    expect(config.rounds?.[0].tracks).toHaveProperty(REAL_UUID_A);
  });

  it("leaves the tracks alone for an id it does not hold", () => {
    expect(withoutTrack(config, "missing").tracks).toEqual(config.tracks);
  });

  it("handles a config with no rounds", () => {
    const noRounds = { ...config, rounds: undefined };

    expect(withoutTrack(noRounds, REAL_UUID_A).rounds).toEqual([]);
  });
});

describe("withFreshTrackIds", () => {
  const track = (name: string) => ({ name, criteria: [] });
  const config: EventScoringConfig = {
    tracks: { [REAL_UUID_A]: track("A"), [REAL_UUID_B]: track("B") },
    defaultMin: 0,
    defaultMax: 10,
    defaultWeight: 1,
    rounds: [
      { round_number: 1, name: "Round 1" },
      { round_number: 2, name: "Finals", tracks: { [REAL_UUID_A]: track("A finals") } },
    ],
  };

  it("re-keys only the listed tracks, in tracks and round overrides", () => {
    const result = withFreshTrackIds(config, [REAL_UUID_A]);

    const [newId, keptId] = Object.keys(result.tracks);
    expect(newId).not.toBe(REAL_UUID_A);
    expect(keptId).toBe(REAL_UUID_B);
    expect(result.tracks[newId].name).toBe("A");
    expect(result.rounds?.[0].tracks).toBeUndefined();
    expect(Object.keys(result.rounds?.[1].tracks ?? {})).toEqual([newId]);
  });

  it("returns the same config when there is nothing to re-key", () => {
    expect(withFreshTrackIds(config, [])).toBe(config);
  });
});

describe("rekeyTrackDescriptions", () => {
  const track = { name: "Track", criteria: [] };
  const config: EventScoringConfig = {
    tracks: { [REAL_UUID_A]: track, [SLUG_ID]: track, [TIMESTAMP_ID]: track },
    defaultMin: 0,
    defaultMax: 10,
    defaultWeight: 1,
  };

  it("moves edited descriptions onto the re-keyed track ids", () => {
    const rekeyed = withUuidTrackIds(config);
    const [, slugNewId, timestampNewId] = Object.keys(rekeyed.tracks);

    expect(
      rekeyTrackDescriptions(
        { descriptions: { [REAL_UUID_A]: "kept", [SLUG_ID]: "imported" } },
        config,
        rekeyed,
      ),
    ).toEqual({ descriptions: { [REAL_UUID_A]: "kept", [slugNewId]: "imported" } });
    expect(timestampNewId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the details unchanged when nothing was re-keyed", () => {
    const details = { descriptions: { [REAL_UUID_A]: "kept" } };
    expect(rekeyTrackDescriptions(details, config, config)).toBe(details);
  });

  it("passes through missing details", () => {
    expect(rekeyTrackDescriptions(undefined, config, withUuidTrackIds(config))).toBeUndefined();
  });
});
