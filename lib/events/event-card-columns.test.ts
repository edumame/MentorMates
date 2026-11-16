import {
  EVENT_LIST_SUMMARY_MAX_LENGTH,
  toEventListSummary,
  withListSummary,
} from "./event-card-columns";

describe("toEventListSummary", () => {
  it("keeps null and undefined as null", () => {
    expect(toEventListSummary(null)).toBeNull();
    expect(toEventListSummary(undefined)).toBeNull();
  });

  it("collapses whitespace the way the cards display it", () => {
    expect(toEventListSummary("  Hack\n\n the   planet  ")).toBe("Hack the planet");
  });

  it("leaves a summary at exactly the limit untouched", () => {
    const text = "a".repeat(EVENT_LIST_SUMMARY_MAX_LENGTH);
    expect(toEventListSummary(text)).toBe(text);
  });

  it("cuts long descriptions to the limit and marks the cut", () => {
    const result = toEventListSummary("word ".repeat(500))!;
    expect(result.length).toBeLessThanOrEqual(EVENT_LIST_SUMMARY_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it("returns an empty string for whitespace-only text", () => {
    expect(toEventListSummary("   \n ")).toBe("");
  });
});

describe("withListSummary", () => {
  it("replaces only event_description and does not mutate the input", () => {
    const original = { event_id: "e1", event_blurb: "Blurb", event_description: "x ".repeat(400) };
    const result = withListSummary(original);
    expect(result.event_id).toBe("e1");
    expect(result.event_blurb).toBe("Blurb");
    expect(result.event_description!.length).toBeLessThanOrEqual(EVENT_LIST_SUMMARY_MAX_LENGTH);
    expect(original.event_description.length).toBe(800);
  });
});
