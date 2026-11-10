import {
  fromDateTimeLocalValue,
  getVotingWindowState,
  toDateTimeLocalValue,
  validateVotingWindow,
} from "./voting-window";

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("getVotingWindowState", () => {
  it("is open with no bounds", () => {
    expect(getVotingWindowState({ opensAt: null, closesAt: null }, NOW)).toEqual({
      status: "open",
      message: null,
    });
    expect(getVotingWindowState(null, NOW).status).toBe("open");
    expect(getVotingWindowState(undefined, NOW).status).toBe("open");
  });

  it("is not open before opensAt", () => {
    const state = getVotingWindowState({ opensAt: "2026-11-08T13:00:00.000Z", closesAt: null }, NOW);
    expect(state.status).toBe("not_open");
    expect(state.message).toMatch(/^Voting opens /);
  });

  it("opens exactly at opensAt", () => {
    expect(getVotingWindowState({ opensAt: NOW.toISOString(), closesAt: null }, NOW).status).toBe("open");
  });

  it("is closed at and after closesAt", () => {
    expect(getVotingWindowState({ opensAt: null, closesAt: NOW.toISOString() }, NOW)).toEqual({
      status: "closed",
      message: "Voting has closed.",
    });
    expect(
      getVotingWindowState({ opensAt: "2026-11-01T00:00:00Z", closesAt: "2026-11-02T00:00:00Z" }, NOW).status
    ).toBe("closed");
  });

  it("is open inside the window and announces the close time", () => {
    const state = getVotingWindowState(
      { opensAt: "2026-11-08T11:00:00Z", closesAt: "2026-11-08T13:00:00Z" },
      NOW
    );
    expect(state.status).toBe("open");
    expect(state.message).toMatch(/^Voting closes /);
  });

  it("ignores unparseable bounds instead of locking voting", () => {
    expect(getVotingWindowState({ opensAt: "not-a-date", closesAt: "nope" }, NOW).status).toBe("open");
  });
});

describe("validateVotingWindow", () => {
  it("accepts empty and ordered windows", () => {
    expect(validateVotingWindow({ opensAt: null, closesAt: null })).toBeNull();
    expect(validateVotingWindow({ opensAt: "2026-11-08T10:00:00Z", closesAt: null })).toBeNull();
    expect(validateVotingWindow({ opensAt: null, closesAt: "2026-11-08T10:00:00Z" })).toBeNull();
    expect(
      validateVotingWindow({ opensAt: "2026-11-08T10:00:00Z", closesAt: "2026-11-08T11:00:00Z" })
    ).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(validateVotingWindow({ opensAt: "garbage", closesAt: null })).toBe("Invalid voting open time");
    expect(validateVotingWindow({ opensAt: null, closesAt: "garbage" })).toBe("Invalid voting close time");
  });

  it("rejects opening at or after closing", () => {
    expect(
      validateVotingWindow({ opensAt: "2026-11-08T11:00:00Z", closesAt: "2026-11-08T11:00:00Z" })
    ).toBe("Voting must open before it closes");
    expect(
      validateVotingWindow({ opensAt: "2026-11-08T12:00:00Z", closesAt: "2026-11-08T11:00:00Z" })
    ).toBe("Voting must open before it closes");
  });
});

describe("datetime-local conversion", () => {
  it("round-trips through the viewer's local timezone", () => {
    const iso = "2026-11-08T12:34:00.000Z";
    const local = toDateTimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDateTimeLocalValue(local)).toBe(iso);
  });

  it("handles empty and invalid values", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue("bad")).toBe("");
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("bad")).toBeNull();
  });
});
