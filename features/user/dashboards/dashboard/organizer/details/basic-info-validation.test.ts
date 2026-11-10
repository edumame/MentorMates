import { validateBasicInfo } from "./basic-info-validation";

const valid = {
  event_name: "  QA fixC Hackathon  ",
  slug: "qa-fixc-hackathon",
  submission_time_start: "2026-12-01T10:00:00.000Z",
  submission_time_cutoff: "2026-12-02T10:00:00.000Z",
};

describe("validateBasicInfo (ORG-014/015/016)", () => {
  it("accepts valid input and trims the name", () => {
    expect(validateBasicInfo(valid)).toEqual({
      ok: true,
      values: { event_name: "QA fixC Hackathon", slug: "qa-fixc-hackathon" },
    });
  });

  it("enforces the 3-120 character name rule", () => {
    expect(validateBasicInfo({ ...valid, event_name: "ab" }).ok).toBe(false);
    expect(validateBasicInfo({ ...valid, event_name: "x".repeat(121) }).ok).toBe(false);
    expect(validateBasicInfo({ ...valid, event_name: "x".repeat(120) }).ok).toBe(true);
  });

  it("stores an empty slug as null and rejects invalid / UUID-shaped slugs", () => {
    expect(validateBasicInfo({ ...valid, slug: "  " })).toEqual({
      ok: true,
      values: { event_name: "QA fixC Hackathon", slug: null },
    });
    expect(validateBasicInfo({ ...valid, slug: "Bad Slug" }).ok).toBe(false);
    expect(validateBasicInfo({ ...valid, slug: "11111111-1111-4111-8111-111111111111" }).ok).toBe(false);
  });

  it("rejects a window that closes before it opens, but lets the legacy equal default through", () => {
    const bad = validateBasicInfo({ ...valid, submission_time_cutoff: "2026-11-30T10:00:00.000Z" });
    expect(bad).toEqual(expect.objectContaining({ ok: false, title: "Check the submission window" }));
    expect(
      validateBasicInfo({ ...valid, submission_time_cutoff: valid.submission_time_start }).ok
    ).toBe(true);
  });
});
