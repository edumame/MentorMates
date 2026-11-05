import {
  getNumericCriterionScore,
  rankProjectsForAdvancement,
  type AdvancementScoreRow,
} from "@/lib/judging/rounds";
import type { ScoringCriterion } from "@/lib/types";

function criterion(
  id: string,
  overrides: Partial<ScoringCriterion> = {}
): ScoringCriterion {
  return { id, name: id, description: "", weight: 1, ...overrides };
}

const flatRubric = [criterion("impact"), criterion("polish")];

function row(
  overrides: Partial<AdvancementScoreRow> &
    Pick<AdvancementScoreRow, "project_id" | "scores">
): AdvancementScoreRow {
  return {
    track_id: "t1",
    judge_id: "j1",
    criteria: flatRubric,
    project_name: overrides.project_id,
    lead_name: "",
    ...overrides,
  };
}

describe("rankProjectsForAdvancement", () => {
  it("ranks projects by their average total across judges, like the scores table", () => {
    expect(
      rankProjectsForAdvancement([
        row({
          project_id: "p1",
          project_name: "Alpha",
          lead_name: "Alice",
          judge_id: "j1",
          scores: { impact: 8, polish: 6 },
        }),
        row({
          project_id: "p1",
          project_name: "Alpha",
          lead_name: "Alice",
          judge_id: "j2",
          scores: { impact: 10, polish: 8 },
        }),
        row({
          project_id: "p2",
          project_name: "Beta",
          lead_name: "Bob",
          judge_id: "j1",
          scores: { impact: 9, polish: 9 },
        }),
      ])
    ).toEqual([
      {
        projectId: "p2",
        projectName: "Beta",
        leadName: "Bob",
        score: 18,
        judgeCount: 1,
      },
      {
        projectId: "p1",
        projectName: "Alpha",
        leadName: "Alice",
        score: 16,
        judgeCount: 2,
      },
    ]);
  });

  it("applies criterion weights", () => {
    const criteria = [
      criterion("tech", { weight: 3 }),
      criterion("design", { weight: 1 }),
    ];

    const ranked = rankProjectsForAdvancement([
      row({ project_id: "a", criteria, scores: { tech: 10, design: 2 } }),
      row({ project_id: "b", criteria, scores: { tech: 6, design: 8 } }),
    ]);

    expect(ranked.map(({ projectId, score }) => [projectId, score])).toEqual([
      ["a", 32],
      ["b", 26],
    ]);
  });

  it("treats a missing weight as 1", () => {
    const criteria = [criterion("tech", { weight: undefined })];

    expect(
      rankProjectsForAdvancement([
        row({ project_id: "a", criteria, scores: { tech: 7 } }),
      ])[0].score
    ).toBe(7);
  });

  it("does not let multiple-choice answers affect the score", () => {
    const criteria = [
      criterion("a"),
      criterion("b"),
      criterion("mc", { type: "multiplechoice", options: ["Yes", "5"] }),
    ];

    const ranked = rankProjectsForAdvancement([
      row({ project_id: "blank", criteria, scores: { a: 8, b: 8, mc: "" } }),
      row({ project_id: "yes", criteria, scores: { a: 8, b: 8, mc: "Yes" } }),
      row({ project_id: "five", criteria, scores: { a: 8, b: 8, mc: "5" } }),
    ]);

    expect(ranked.map((project) => project.score)).toEqual([16, 16, 16]);
  });

  it("ignores keys that are not in the rubric", () => {
    expect(
      rankProjectsForAdvancement([
        row({
          project_id: "p1",
          scores: { impact: 5, polish: 5, deleted: 10 },
        }),
      ])[0].score
    ).toBe(10);
  });

  it("skips a blank numeric answer and accepts a numeric string", () => {
    expect(
      rankProjectsForAdvancement([
        row({ project_id: "p1", scores: { impact: "7", polish: "" } }),
      ])[0].score
    ).toBe(7);
  });

  it("counts a judge once however many tracks they scored", () => {
    const ranked = rankProjectsForAdvancement([
      row({ project_id: "p1", track_id: "t1", scores: { impact: 5 } }),
      row({ project_id: "p1", track_id: "t2", scores: { impact: 5 } }),
      row({ project_id: "p1", track_id: "t3", scores: { impact: 5 } }),
    ]);

    expect(ranked[0].judgeCount).toBe(1);
  });

  it("gives each track equal say for a project in several tracks", () => {
    const ranked = rankProjectsForAdvancement([
      row({
        project_id: "p1",
        track_id: "t1",
        judge_id: "j1",
        scores: { impact: 2 },
      }),
      row({
        project_id: "p1",
        track_id: "t1",
        judge_id: "j2",
        scores: { impact: 4 },
      }),
      row({
        project_id: "p1",
        track_id: "t2",
        judge_id: "j3",
        scores: { impact: 9 },
      }),
    ]);

    // Track means are 3 and 9. Pooling the three rows would give 5.
    expect(ranked[0].score).toBe(6);
    expect(ranked[0].judgeCount).toBe(3);
  });

  it("scores each row against its own track's rubric", () => {
    const ranked = rankProjectsForAdvancement([
      row({
        project_id: "p1",
        track_id: "t1",
        criteria: [criterion("x", { weight: 2 })],
        scores: { x: 5, y: 100 },
      }),
      row({
        project_id: "p1",
        track_id: "t2",
        criteria: [criterion("y", { weight: 1 })],
        scores: { x: 100, y: 4 },
      }),
    ]);

    expect(ranked[0].score).toBe(7);
  });

  it("does not count a judge whose row has no usable score", () => {
    const ranked = rankProjectsForAdvancement([
      row({ project_id: "p1", judge_id: "j1", scores: { impact: 6 } }),
      row({ project_id: "p1", judge_id: "j2", scores: { deleted: 9 } }),
    ]);

    expect(ranked[0]).toMatchObject({ score: 6, judgeCount: 1 });
  });

  it("ignores rows without numeric scores or without a rubric", () => {
    expect(
      rankProjectsForAdvancement([
        row({
          project_id: "p1",
          criteria: [criterion("recommendation", { type: "multiplechoice" })],
          scores: { recommendation: "yes" },
        }),
        row({ project_id: "p2", scores: null }),
        row({ project_id: "p3", criteria: null, scores: { impact: 9 } }),
      ])
    ).toEqual([]);
  });

  it("breaks ties by project name", () => {
    const ranked = rankProjectsForAdvancement([
      row({ project_id: "p2", project_name: "Beta", scores: { impact: 5 } }),
      row({ project_id: "p1", project_name: "Alpha", scores: { impact: 5 } }),
    ]);

    expect(ranked.map((project) => project.projectName)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });
});

describe("getNumericCriterionScore", () => {
  it("returns numbers and numeric strings", () => {
    expect(getNumericCriterionScore(criterion("a"), 0)).toBe(0);
    expect(getNumericCriterionScore(criterion("a"), "7.5")).toBe(7.5);
  });

  it("returns null for blank or missing values", () => {
    expect(getNumericCriterionScore(criterion("a"), "")).toBeNull();
    expect(getNumericCriterionScore(criterion("a"), undefined)).toBeNull();
    expect(getNumericCriterionScore(criterion("a"), null)).toBeNull();
  });

  it("returns null for multiple-choice criteria", () => {
    expect(
      getNumericCriterionScore(criterion("a", { type: "multiplechoice" }), "5")
    ).toBeNull();
  });
});
