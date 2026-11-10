import { rankProjectsForAdvancement } from "@/lib/judging/advancement-ranking";

const rubricConfig = {
  tracks: {
    t1: {
      name: "Main",
      criteria: [
        { id: "impact", name: "Impact", description: "", type: "numeric" as const, min: 1, max: 10, weight: 3 },
        { id: "polish", name: "Polish", description: "", type: "numeric" as const, min: 1, max: 10, weight: 1 },
        { id: "pick", name: "Pick", description: "", type: "multiplechoice" as const, options: ["yes", "no"] },
      ],
    },
    t2: {
      name: "Side",
      criteria: [{ id: "x", name: "X", description: "", type: "numeric" as const, min: 1, max: 5 }],
    },
  },
};
const row = (project_id: string, judge_id: string, scores: Record<string, unknown> | null, track_id = "t1") => ({
  project_id,
  judge_id,
  track_id,
  track_name: track_id === "t1" ? "Main" : "Side",
  project_name: project_id === "p1" ? "Alpha" : project_id === "p2" ? "Beta" : "Gamma",
  lead_name: "Lead",
  scores,
});
const options = { scoringConfig: rubricConfig, roundNumber: 1 };

describe("rankProjectsForAdvancement (computeWeightedScore, JUDGE-007)", () => {
  it("uses the range-normalised weighted score (0-10) per scorecard and averages scorecards", () => {
    // Lane C round 2 formula: 10 × Σ w·(v-min)/(max-min) / Σ w.
    // p1: 10·(3·7/9 + 3/9)/4 = 20/3 and 10·(3 + 5/9)/4 = 80/9 -> 70/9; p2: 10·(3·5/9 + 1)/4 = 20/3
    const ranked = rankProjectsForAdvancement(
      [row("p1", "j1", { impact: 8, polish: 4 }), row("p1", "j2", { impact: 10, polish: 6 }), row("p2", "j1", { impact: 6, polish: 10 })],
      options
    );
    expect(ranked).toEqual([
      { projectId: "p1", projectName: "Alpha", leadName: "Lead", score: expect.closeTo(70 / 9, 10), judgeCount: 2, rank: 1 },
      { projectId: "p2", projectName: "Beta", leadName: "Lead", score: expect.closeTo(20 / 3, 10), judgeCount: 1, rank: 2 },
    ]);
  });

  it("ranks on each track's own rubric scale", () => {
    const ranked = rankProjectsForAdvancement([row("p1", "j1", { x: 5 }, "t2"), row("p2", "j1", { impact: 4, polish: 4 })], options);
    // p1 x=5 on a 1-5 rubric is a perfect 10; p2 4/4 on 1-10 is 10/3
    expect(ranked.map((c) => [c.projectId, c.score])).toEqual([
      ["p1", 10],
      ["p2", expect.closeTo(10 / 3, 10)],
    ]);
  });

  it("drops scorecards with out-of-range legacy values instead of letting them dominate", () => {
    const ranked = rankProjectsForAdvancement(
      [row("p1", "j1", { impact: 9999, polish: 2 }), row("p2", "j1", { impact: 5, polish: 5 })],
      options
    );
    expect(ranked.map((c) => [c.projectId, c.score])).toEqual([["p2", expect.closeTo(40 / 9, 10)]]);
  });

  it("drops incomplete scorecards (an unanswered weighted criterion)", () => {
    const ranked = rankProjectsForAdvancement(
      [row("p1", "j1", { impact: 10 }), row("p2", "j1", { impact: 2, polish: 2 })],
      options
    );
    expect(ranked.map((c) => c.projectId)).toEqual(["p2"]);
  });

  it("excludes scorecards from former judges when the active set is known", () => {
    const rows = [row("p1", "gone", { impact: 10, polish: 10 }), row("p1", "j1", { impact: 2, polish: 2 }), row("p2", "j1", { impact: 5, polish: 5 })];
    expect(rankProjectsForAdvancement(rows, { ...options, activeJudgeIds: new Set(["j1"]) }).map((c) => [c.projectId, c.score, c.judgeCount])).toEqual([
      ["p2", expect.closeTo(40 / 9, 10), 1],
      ["p1", expect.closeTo(10 / 9, 10), 1],
    ]);
    // null active set = count everyone (lookup failure fallback)
    expect(rankProjectsForAdvancement(rows, { ...options, activeJudgeIds: null })[0]).toMatchObject({ projectId: "p1", score: expect.closeTo(50 / 9, 10), judgeCount: 2 });
  });

  it("gives tied projects the same competition rank", () => {
    const ranked = rankProjectsForAdvancement(
      [row("p1", "j1", { impact: 5, polish: 5 }), row("p2", "j1", { impact: 5, polish: 5 }), row("p3", "j1", { impact: 1, polish: 1 })],
      options
    );
    expect(ranked.map((c) => [c.projectName, c.rank])).toEqual([
      ["Alpha", 1],
      ["Beta", 1],
      ["Gamma", 3],
    ]);
  });

  it("skips scorecards with no numeric answers, no track, unknown track or no config", () => {
    expect(
      rankProjectsForAdvancement(
        [row("p1", "j1", { pick: "yes" }), row("p2", "j1", null), { ...row("p3", "j1", { impact: 5 }), track_id: null }, row("p3", "j1", { impact: 5 }, "missing")],
        options
      )
    ).toEqual([]);
    expect(rankProjectsForAdvancement([row("p1", "j1", { impact: 5 })], { scoringConfig: null, roundNumber: 1 })).toEqual([]);
  });

  it("applies the round's rubric override", () => {
    const config = {
      ...rubricConfig,
      rounds: [
        { round_number: 1, name: "R1" },
        { round_number: 2, name: "R2", criteria: [{ id: "final", name: "Final", description: "", type: "numeric" as const, min: 1, max: 10 }] },
      ],
    };
    const rows = [row("p1", "j1", { final: 9 }), row("p2", "j1", { impact: 9, polish: 9 })];
    expect(rankProjectsForAdvancement(rows, { scoringConfig: config, roundNumber: 2 }).map((c) => c.projectId)).toEqual(["p1"]);
  });
});
