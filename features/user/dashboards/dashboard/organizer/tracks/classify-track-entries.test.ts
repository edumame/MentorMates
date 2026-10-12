import { classifyTrackEntries } from "./classify-track-entries";

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

  it("classifies a UUID that does NOT exist in DB as new", () => {
    const result = classifyTrackEntries(
      [REAL_UUID_A],
      new Set([REAL_UUID_B]), // different UUID in DB
      EVENT_ID,
      buildEntry,
    );
    expect(result.newTracks).toHaveLength(1);
    expect(result.newTracks[0]).not.toHaveProperty("track_id");
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
