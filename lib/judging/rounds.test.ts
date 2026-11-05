import {
  canScoreProjectInActiveRound,
  filterScoresToRoundEligibleProjects,
  rankProjectsForAdvancement,
} from "@/lib/judging/rounds";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("rankProjectsForAdvancement", () => {
  it("ranks projects by their average score across all submitted scorecards", () => {
    expect(
      rankProjectsForAdvancement([
        {
          project_id: "p1",
          project_name: "Alpha",
          lead_name: "Alice",
          scores: { impact: 8, polish: 6 },
        },
        {
          project_id: "p1",
          project_name: "Alpha",
          lead_name: "Alice",
          scores: { impact: 10, polish: 8 },
        },
        {
          project_id: "p2",
          project_name: "Beta",
          lead_name: "Bob",
          scores: { impact: 9, polish: 9 },
        },
      ])
    ).toEqual([
      {
        projectId: "p2",
        projectName: "Beta",
        leadName: "Bob",
        score: 9,
        judgeCount: 1,
      },
      {
        projectId: "p1",
        projectName: "Alpha",
        leadName: "Alice",
        score: 8,
        judgeCount: 2,
      },
    ]);
  });

  it("ignores rows without numeric scores", () => {
    expect(
      rankProjectsForAdvancement([
        {
          project_id: "p1",
          project_name: "Alpha",
          lead_name: "Alice",
          scores: { recommendation: "yes" },
        },
        {
          project_id: "p2",
          project_name: "Beta",
          lead_name: "Bob",
          scores: null,
        },
      ])
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

describe("canScoreProjectInActiveRound", () => {
  const tables = {
    events: [{ event_id: "e", scoring_config: { activeRound: 2 } }],
    project_round_advancements: [
      { event_id: "e", project_id: "a", round_number: 2 },
    ],
    project_assignments: [
      { event_id: "e", project_id: "a", user_id: "j", role: "judge" },
    ],
  };
  const input = {
    eventId: "e",
    projectId: "a",
    userId: "j",
    requireAssignment: true,
  };

  it("allows an assigned judge on an advanced project", async () => {
    await expect(
      canScoreProjectInActiveRound(fakeSupabase(tables), input)
    ).resolves.toBe(true);
  });

  it("rejects a project that did not advance to the active round", async () => {
    await expect(
      canScoreProjectInActiveRound(fakeSupabase(tables), {
        ...input,
        projectId: "b",
      })
    ).resolves.toBe(false);
  });

  it("rejects an unassigned judge unless assignment is not required", async () => {
    const unassigned = { ...input, userId: "other" };

    await expect(
      canScoreProjectInActiveRound(fakeSupabase(tables), unassigned)
    ).resolves.toBe(false);
    await expect(
      canScoreProjectInActiveRound(fakeSupabase(tables), {
        ...unassigned,
        requireAssignment: false,
      })
    ).resolves.toBe(true);
  });
});
