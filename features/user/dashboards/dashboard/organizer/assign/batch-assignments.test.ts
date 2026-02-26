import { buildJudgeProjectPairs } from "./batch-assignments";

describe("buildJudgeProjectPairs", () => {
  it("builds a full judge-project cartesian product", () => {
    const pairs = buildJudgeProjectPairs(
      ["judge-a", "judge-b"],
      ["project-1", "project-2"]
    );

    expect(pairs).toEqual([
      { judgeId: "judge-a", projectId: "project-1" },
      { judgeId: "judge-a", projectId: "project-2" },
      { judgeId: "judge-b", projectId: "project-1" },
      { judgeId: "judge-b", projectId: "project-2" },
    ]);
  });

  it("deduplicates judge IDs and project IDs", () => {
    const pairs = buildJudgeProjectPairs(
      ["judge-a", "judge-a", "judge-b"],
      ["project-1", "project-1"]
    );

    expect(pairs).toEqual([
      { judgeId: "judge-a", projectId: "project-1" },
      { judgeId: "judge-b", projectId: "project-1" },
    ]);
  });

  it("filters empty IDs and returns no pairs for empty selections", () => {
    const pairsWithEmptyValues = buildJudgeProjectPairs(
      ["judge-a", ""],
      ["project-1", ""]
    );
    const pairsWithNoSelections = buildJudgeProjectPairs([], []);

    expect(pairsWithEmptyValues).toEqual([
      { judgeId: "judge-a", projectId: "project-1" },
    ]);
    expect(pairsWithNoSelections).toEqual([]);
  });
});
