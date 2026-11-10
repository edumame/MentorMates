import {
  buildScoresPayload,
  getDefaultScores,
  getScoreSaveErrorMessage,
} from "./scoring-defaults";

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

describe("buildScoresPayload", () => {
  const criteria = [
    { id: "innov", name: "Innovation", description: "", type: "numeric" as const, min: 1, max: 10 },
    { id: "tech", name: "Technical", description: "", type: "numeric" as const, min: 1, max: 5 },
    { id: "pick", name: "Pick", description: "", type: "multiplechoice" as const, options: ["Yes", "No"] },
  ];

  it("keeps only current rubric criteria and drops stale keys", () => {
    expect(
      buildScoresPayload(criteria, { innov: 7, tech: 3, pick: "Yes", removed: 9 })
    ).toEqual({ innov: 7, tech: 3, pick: "Yes" });
  });

  it("coerces numeric strings to numbers", () => {
    expect(buildScoresPayload(criteria, { innov: "8", tech: " 2 ", pick: "No" })).toEqual({
      innov: 8,
      tech: 2,
      pick: "No",
    });
  });

  it("falls back to criterion defaults for missing or non-numeric values", () => {
    expect(buildScoresPayload(criteria, { innov: "abc", tech: null })).toEqual({
      innov: 1,
      tech: 1,
      pick: "",
    });
    expect(buildScoresPayload(criteria, undefined)).toEqual({ innov: 1, tech: 1, pick: "" });
  });

  it("stringifies multiple choice values and blanks unsupported types", () => {
    expect(
      buildScoresPayload([{ ...criteria[2], options: ["1", "2"] }], { pick: 2 })
    ).toEqual({ pick: "2" });
    expect(buildScoresPayload([criteria[2]], { pick: { bad: true } })).toEqual({ pick: "" });
  });

  it("returns an empty payload for an empty rubric", () => {
    expect(buildScoresPayload([], { innov: 5 })).toEqual({});
  });
});

describe("getScoreSaveErrorMessage", () => {
  it("surfaces database validation messages", () => {
    expect(
      getScoreSaveErrorMessage({ code: "23514", message: 'Invalid value for scoring criterion "innov"' })
    ).toBe('Invalid value for scoring criterion "innov"');
  });

  it("explains RLS rejections for unassigned projects or inactive rounds", () => {
    expect(getScoreSaveErrorMessage({ code: "42501", message: "new row violates row-level security" })).toMatch(
      /assigned to you in the current judging round/
    );
  });

  it("explains duplicate rows", () => {
    expect(getScoreSaveErrorMessage({ code: "23505" })).toMatch(/already exists/);
  });

  it("falls back to a generic message", () => {
    expect(getScoreSaveErrorMessage(new Error("network"))).toBe("Failed to save your evaluation");
    expect(getScoreSaveErrorMessage(null)).toBe("Failed to save your evaluation");
    expect(getScoreSaveErrorMessage({ code: "23514" })).toBe("Failed to save your evaluation");
  });
});

describe("Yes/No (0..1) criteria in the scoring form payload", () => {
  const yesNo = { id: "yn", name: "Ready?", description: "", type: "numeric" as const, min: 0, max: 1, weight: 0 };

  it("defaults to 0 and keeps an explicit 0 answer", () => {
    expect(getDefaultScores([yesNo])).toEqual({ yn: 0 });
    expect(buildScoresPayload([yesNo], { yn: 0 })).toEqual({ yn: 0 });
    expect(buildScoresPayload([yesNo], { yn: "0" })).toEqual({ yn: 0 });
    expect(buildScoresPayload([yesNo], { yn: 1 })).toEqual({ yn: 1 });
  });
});
