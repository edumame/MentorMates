import {
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

    it("returns true for projects without tracks", () => {
      const scoredProjects = new Map<string, Set<string>>();

      const result = isProjectFullyScored(
        {
          id: "project-1",
          track_ids: [],
        },
        scoredProjects
      );

      expect(result).toBe(true);
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
});
