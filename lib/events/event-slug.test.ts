import { getEventSlugError, isDuplicateEventSlugError } from "./event-slug";

describe("getEventSlugError (ORG-014)", () => {
  it.each(["hack-night", "a", "spring-2026", "x1-y2-z3"])("accepts %p", (slug) => {
    expect(getEventSlugError(slug)).toBeNull();
  });

  it.each([
    ["", /empty/],
    ["Bad Slug/With Spaces", /lowercase/],
    ["slug?x=1", /lowercase/],
    ["-leading", /lowercase/],
    ["double--dash", /lowercase/],
    ["UPPER", /lowercase/],
    ["123e4567-e89b-42d3-a456-426614174000", /event ID/],
    ["a".repeat(81), /at most/],
  ])("rejects %p", (slug, message) => {
    expect(getEventSlugError(slug)).toMatch(message);
  });
});

describe("isDuplicateEventSlugError", () => {
  it("recognises the events_slug_key unique violation", () => {
    expect(isDuplicateEventSlugError({ code: "23505", message: 'duplicate key value violates unique constraint "events_slug_key"' })).toBe(true);
    expect(isDuplicateEventSlugError({ code: "23505", message: 'duplicate key value violates unique constraint "events_pkey"' })).toBe(false);
    expect(isDuplicateEventSlugError(null)).toBe(false);
  });
});
