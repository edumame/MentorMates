import {
  filterScoresToCurrentProjectTracks,
  filterScoresToRoundEligibleProjects,
  getActiveRound,
  isProjectInActiveRound,
} from "@/lib/judging/rounds";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function fakeSupabase(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        limit: () => query,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (
          resolve: (value: {
            data: Record<string, unknown>[];
            error: null;
          }) => unknown
        ) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("filterScoresToRoundEligibleProjects", () => {
  const tables = {
    project_round_advancements: [
      { event_id: "e", project_id: "a", round_number: 2 },
    ],
    projects: [
      { id: "a", event_id: "e", submitted: true },
      { id: "b", event_id: "e", submitted: true },
      { id: "draft", event_id: "e", submitted: false },
    ],
  };

  it("checks each score against the round it was given in", async () => {
    const rows = [
      { project_id: "a", round_number: 1 },
      { project_id: "b", round_number: 1 },
      { project_id: "draft", round_number: 1 },
      { project_id: "a", round_number: 2 },
      { project_id: "b", round_number: 2 },
    ];

    await expect(
      filterScoresToRoundEligibleProjects(fakeSupabase(tables), "e", rows)
    ).resolves.toEqual([
      { project_id: "a", round_number: 1 },
      { project_id: "b", round_number: 1 },
      { project_id: "a", round_number: 2 },
    ]);
  });

  it("treats a score without a round number as round 1", async () => {
    const rows = [{ project_id: "a" }, { project_id: "draft", round_number: null }];

    await expect(
      filterScoresToRoundEligibleProjects(fakeSupabase(tables), "e", rows)
    ).resolves.toEqual([{ project_id: "a" }]);
  });

  it("drops every score for a later round nobody has advanced to", async () => {
    await expect(
      filterScoresToRoundEligibleProjects(fakeSupabase(tables), "e", [
        { project_id: "a", round_number: 3 },
      ])
    ).resolves.toEqual([]);
  });
});

describe("isProjectInActiveRound", () => {
  const tables = {
    events: [{ event_id: "e", scoring_config: { activeRound: 2 } }],
    project_round_advancements: [
      { event_id: "e", project_id: "a", round_number: 2 },
    ],
    projects: [
      { id: "a", event_id: "e", submitted: true },
      { id: "b", event_id: "e", submitted: true },
    ],
  };

  it("accepts a project advanced to the active round", async () => {
    await expect(
      isProjectInActiveRound(fakeSupabase(tables), { eventId: "e", projectId: "a" })
    ).resolves.toBe(true);
  });

  it("rejects a project that did not advance to the active round", async () => {
    await expect(
      isProjectInActiveRound(fakeSupabase(tables), { eventId: "e", projectId: "b" })
    ).resolves.toBe(false);
  });

  it("uses submission for round 1", async () => {
    const roundOne = { ...tables, events: [{ event_id: "e", scoring_config: {} }] };
    await expect(
      isProjectInActiveRound(fakeSupabase(roundOne), { eventId: "e", projectId: "b" })
    ).resolves.toBe(true);
  });
});
