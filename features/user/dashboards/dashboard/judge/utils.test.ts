import {
  buildJudgeScoreMaps,
  getNextProjectId,
  isProjectFullyScored,
  truncateWithEllipsis,
} from "./utils";

describe("judge dashboard utils", () => {
  describe("isProjectFullyScored", () => {
    it("returns true when all tracks are scored", () => {
      const scoredProjects = new Map<string, Set<string>>([
        ["project-1", new Set(["track-a", "track-b"])],
      ]);

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: ["track-a", "track-b"],
        },
        scoredProjects
      );

      expect(result).toBe(true);
    });

    it("returns false when at least one track is missing", () => {
      const scoredProjects = new Map<string, Set<string>>([
        ["project-1", new Set(["track-a"])],
      ]);

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: ["track-a", "track-b"],
        },
        scoredProjects
      );

      expect(result).toBe(false);
    });

    it("returns false for projects without tracks so assigned projects stay visible", () => {
      const scoredProjects = new Map<string, Set<string>>();

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: [],
        },
        scoredProjects
      );

      expect(result).toBe(false);
    });
  });

  describe("getNextProjectId", () => {
    const projects = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

    it("returns null for empty decks", () => {
      expect(getNextProjectId([], "p1", 1)).toBeNull();
    });

    it("returns first project when current is missing", () => {
      expect(getNextProjectId(projects, "unknown", 1)).toBe("p1");
    });

    it("wraps forward navigation", () => {
      expect(getNextProjectId(projects, "p3", 1)).toBe("p1");
    });

    it("wraps backward navigation", () => {
      expect(getNextProjectId(projects, "p1", -1)).toBe("p3");
    });
  });

  describe("truncateWithEllipsis", () => {
    it("returns full text when under the limit", () => {
      expect(truncateWithEllipsis("hello", 10)).toBe("hello");
    });

    it("truncates text and appends ellipsis", () => {
      expect(truncateWithEllipsis("hello world", 5)).toBe("hello...");
    });
  });

  describe("buildJudgeScoreMaps", () => {
    const projects = [{ id: "project-1", track_ids: ["track-a"] }];
    const scoreA = { impact: 4 };
    const scoreB = { impact: 10 };

    it("ignores scores for a track the project was removed from", () => {
      const { scoredProjects, scoreValues } = buildJudgeScoreMaps(
        [
          { project_id: "project-1", track_id: "track-a", scores: scoreA },
          { project_id: "project-1", track_id: "track-b", scores: scoreB },
        ],
        projects
      );

      expect(scoredProjects.get("project-1")).toEqual(new Set(["track-a"]));
      expect(scoreValues.get("project-1")).toEqual(
        new Map([["track-a", scoreA]])
      );
    });

    it("leaves a project unscored when only a removed track was scored", () => {
      const { scoredProjects, scoreValues } = buildJudgeScoreMaps(
        [{ project_id: "project-1", track_id: "track-b", scores: scoreB }],
        projects
      );

      expect(isProjectFullyScored(projects[0], scoredProjects)).toBe(false);
      expect(scoredProjects.has("project-1")).toBe(false);
      expect(scoreValues.has("project-1")).toBe(false);
    });

    it("marks a track scored even when the row has no score values", () => {
      const { scoredProjects, scoreValues } = buildJudgeScoreMaps(
        [{ project_id: "project-1", track_id: "track-a", scores: null }],
        projects
      );

      expect(scoredProjects.get("project-1")).toEqual(new Set(["track-a"]));
      expect(scoreValues.has("project-1")).toBe(false);
    });

    it("ignores scores for projects not on the dashboard", () => {
      const { scoredProjects } = buildJudgeScoreMaps(
        [{ project_id: "project-2", track_id: "track-a", scores: scoreA }],
        projects
      );

      expect(scoredProjects.size).toBe(0);
    });
  });
});
