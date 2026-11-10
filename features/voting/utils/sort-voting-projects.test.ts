import { sortProjectsForVoting } from "./sort-voting-projects";

const projects = [
  { id: "c", project_name: "charlie" },
  { id: "a", project_name: "Alpha" },
  { id: "b", project_name: "bravo" },
  { id: "n", project_name: null },
];

describe("sortProjectsForVoting", () => {
  it("sorts alphabetically (case-insensitive) when nothing is voted", () => {
    expect(sortProjectsForVoting(projects, () => false).map((p) => p.id)).toEqual(["n", "a", "b", "c"]);
  });

  it("puts the viewer's voted projects first, each group alphabetical", () => {
    const voted = new Set(["c", "b"]);
    expect(sortProjectsForVoting(projects, (id) => voted.has(id)).map((p) => p.id)).toEqual([
      "b",
      "c",
      "n",
      "a",
    ]);
  });

  it("is deterministic for duplicate names and does not mutate input", () => {
    const dupes = [
      { id: "2", project_name: "Same" },
      { id: "1", project_name: "same" },
    ];
    const copy = [...dupes];
    expect(sortProjectsForVoting(dupes, () => false).map((p) => p.id)).toEqual(["1", "2"]);
    expect(dupes).toEqual(copy);
  });
});
