import {
  filterScoresToCurrentProjectTracks,
  rankProjectsForAdvancement,
} from "@/lib/judging/rounds";

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

describe("filterScoresToCurrentProjectTracks", () => {
  const scoreRow = (project_id: string, track_id: string, score: number) => ({
    project_id,
    track_id,
    scores: { impact: score },
    project_name: project_id,
    lead_name: "",
  });

  it("keeps a removed track's row out of the project's score and judge count", () => {
    const rows = [scoreRow("p1", "track-a", 6), scoreRow("p1", "track-b", 10)];

    expect(rankProjectsForAdvancement(rows)[0]).toMatchObject({
      score: 8,
      judgeCount: 2,
    });
    expect(
      rankProjectsForAdvancement(
        filterScoresToCurrentProjectTracks(rows, [
          { project_id: "p1", track_id: "track-a" },
        ])
      )[0]
    ).toMatchObject({ score: 6, judgeCount: 1 });
  });

  it("leaves a project with only stale rows out of the ranking", () => {
    expect(
      rankProjectsForAdvancement(
        filterScoresToCurrentProjectTracks(
          [scoreRow("p1", "track-b", 10), scoreRow("p2", "track-a", 5)],
          [
            { project_id: "p1", track_id: "track-a" },
            { project_id: "p2", track_id: "track-a" },
          ]
        )
      ).map((project) => project.projectId)
    ).toEqual(["p2"]);
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
