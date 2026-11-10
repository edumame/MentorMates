import {
  filterScoresToCurrentProjectTracks,
  getActiveRound,
} from "@/lib/judging/rounds";

describe("getActiveRound", () => {
  const cfg = (activeRound: unknown) => ({ tracks: {}, activeRound } as never);

  it("returns a positive integer activeRound", () => {
    expect(getActiveRound(cfg(2))).toBe(2);
    expect(getActiveRound(cfg(1))).toBe(1);
  });

  it("falls back to round 1 for missing, non-positive or non-integer values (matches DB)", () => {
    expect(getActiveRound(null)).toBe(1);
    expect(getActiveRound(undefined)).toBe(1);
    expect(getActiveRound(cfg(undefined))).toBe(1);
    expect(getActiveRound(cfg(0))).toBe(1);
    expect(getActiveRound(cfg(-3))).toBe(1);
    expect(getActiveRound(cfg(1.5))).toBe(1);
    expect(getActiveRound(cfg("2"))).toBe(1);
    expect(getActiveRound(cfg(Number.NaN))).toBe(1);
  });
});

describe("filterScoresToCurrentProjectTracks", () => {
  const scoreRow = (project_id: string, track_id: string, score: number) => ({
    project_id,
    track_id,
    scores: { impact: score },
    project_name: project_id,
    lead_name: "",
  });

  it("drops a removed track's row and keeps the current one", () => {
    const rows = [scoreRow("p1", "track-a", 6), scoreRow("p1", "track-b", 10)];

    expect(
      filterScoresToCurrentProjectTracks(rows, [
        { project_id: "p1", track_id: "track-a" },
      ])
    ).toEqual([rows[0]]);
  });

  it("drops every row of a project whose scores are all on removed tracks", () => {
    const rows = [scoreRow("p1", "track-b", 10), scoreRow("p2", "track-a", 5)];

    expect(
      filterScoresToCurrentProjectTracks(rows, [
        { project_id: "p1", track_id: "track-a" },
        { project_id: "p2", track_id: "track-a" },
      ])
    ).toEqual([rows[1]]);
  });

  it("keeps legacy rows with no track", () => {
    const row = { ...scoreRow("p1", "track-a", 7), track_id: null };

    expect(
      filterScoresToCurrentProjectTracks([row], [
        { project_id: "p1", track_id: "track-a" },
      ])
    ).toEqual([row]);
  });

  it("matches on the pair, not on the track alone", () => {
    const rows = [scoreRow("p1", "track-b", 10), scoreRow("p2", "track-b", 5)];

    expect(
      filterScoresToCurrentProjectTracks(rows, [
        { project_id: "p2", track_id: "track-b" },
      ])
    ).toEqual([rows[1]]);
  });

  it("drops rows for a project with no current tracks", () => {
    expect(
      filterScoresToCurrentProjectTracks([scoreRow("p1", "track-a", 7)], [])
    ).toEqual([]);
  });
});
