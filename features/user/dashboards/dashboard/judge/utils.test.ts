import {
  getNextProjectId,
  isProjectFullyScored,
  removeTrackScores,
  setTrackScores,
  truncateWithEllipsis,
} from "./utils";

describe("judge dashboard utils", () => {
  describe("setTrackScores", () => {
    it("adds a project and track that had no scores", () => {
      const result = setTrackScores(new Map(), "project-1", "track-a", { q: 7 });

      expect(result.get("project-1")?.get("track-a")).toEqual({ q: 7 });
    });

    it("replaces one track and keeps the others without mutating the input", () => {
      const original = new Map([
        [
          "project-1",
          new Map([
            ["track-a", { q: 7 }],
            ["track-b", { q: 4 }],
          ]),
        ],
      ]);

      const result = setTrackScores(original, "project-1", "track-a", { q: 2 });

      expect(result.get("project-1")?.get("track-a")).toEqual({ q: 2 });
      expect(result.get("project-1")?.get("track-b")).toEqual({ q: 4 });
      expect(original.get("project-1")?.get("track-a")).toEqual({ q: 7 });
    });
  });

  describe("removeTrackScores", () => {
    it("removes the project entry when its last track is removed", () => {
      const original = new Map([
        ["project-1", new Map([["track-a", { q: 7 }]])],
      ]);

      const result = removeTrackScores(original, "project-1", "track-a");

      expect(result.has("project-1")).toBe(false);
      expect(original.get("project-1")?.has("track-a")).toBe(true);
    });

    it("keeps the project's other tracks", () => {
      const original = new Map([
        [
          "project-1",
          new Map([
            ["track-a", { q: 7 }],
            ["track-b", { q: 4 }],
          ]),
        ],
      ]);

      const result = removeTrackScores(original, "project-1", "track-a");

      expect(result.get("project-1")?.has("track-a")).toBe(false);
      expect(result.get("project-1")?.get("track-b")).toEqual({ q: 4 });
    });

    it("leaves other projects alone when the project has no scores", () => {
      const original = new Map([
        ["project-2", new Map([["track-a", { q: 7 }]])],
      ]);

      const result = removeTrackScores(original, "project-1", "track-a");

      expect(result.get("project-2")?.get("track-a")).toEqual({ q: 7 });
      expect(result.has("project-1")).toBe(false);
    });
  });

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
});
