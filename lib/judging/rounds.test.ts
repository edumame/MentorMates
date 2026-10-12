import { rankProjectsForAdvancement } from "@/lib/judging/rounds";

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
