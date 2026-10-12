import { getDefaultScores } from "./scoring-defaults";

describe("getDefaultScores", () => {
  it("keeps numeric minimum score when it is 0", () => {
    const defaults = getDefaultScores([
      {
        id: "binary",
        name: "Binary decision",
        description: "Should allow 0 and 1",
        type: "numeric",
        min: 0,
        max: 1,
      },
    ]);

    expect(defaults.binary).toBe(0);
  });

  it("returns blank default for multiple choice criteria", () => {
    const defaults = getDefaultScores([
      {
        id: "choice",
        name: "Pick one",
        description: "Multiple choice question",
        type: "multiplechoice",
        options: ["Yes", "No"],
      },
    ]);

    expect(defaults.choice).toBe("");
  });

  it("defaults numeric criteria to 0 when min is not provided", () => {
    const defaults = getDefaultScores([
      {
        id: "numeric-default",
        name: "Numeric default",
        description: "No min configured",
        type: "numeric",
      },
    ]);

    expect(defaults["numeric-default"]).toBe(0);
  });
});
