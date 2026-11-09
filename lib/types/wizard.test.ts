/**
 * @jest-environment node
 */
// ORG-015: datetime-local values must be read in the organizer's time zone.
process.env.TZ = "America/Los_Angeles";

import {
  buildApiPayload,
  INITIAL_WIZARD_EVENT,
  toSubmissionWindowIso,
  validateSubmissionWindow,
} from "./wizard";

describe("submission window conversion", () => {
  it("interprets naive datetime-local values in the browser time zone", () => {
    expect(toSubmissionWindowIso("2026-12-01T10:00")).toBe("2026-12-01T18:00:00.000Z");
    // DST: July is UTC-7 in Los Angeles.
    expect(toSubmissionWindowIso("2026-07-01T10:00:30")).toBe("2026-07-01T17:00:30.000Z");
  });

  it("keeps values that already carry an offset", () => {
    expect(toSubmissionWindowIso("2026-12-01T10:00:00Z")).toBe("2026-12-01T10:00:00.000Z");
    expect(toSubmissionWindowIso("2026-12-01T10:00:00+09:00")).toBe("2026-12-01T01:00:00.000Z");
  });

  it.each(["", "   ", undefined, null, "tomorrow", "2026-12-01", "2026-13-45T99:99"])(
    "returns null for empty or invalid value %p",
    (value) => {
      expect(toSubmissionWindowIso(value)).toBeNull();
    }
  );

  it("rejects DST-gap times and picks the earlier instant for ambiguous ones", () => {
    expect(validateSubmissionWindow("2026-03-08T02:30", "2026-03-09T10:00")).toMatch(/^Opens: .*does not exist/);
    expect(toSubmissionWindowIso("2026-03-08T02:30")).toBeNull();
    expect(toSubmissionWindowIso("2026-11-01T01:30")).toBe("2026-11-01T08:30:00.000Z");
    expect(toSubmissionWindowIso("2026-12-01T10:00", "Asia/Tokyo")).toBe("2026-12-01T01:00:00.000Z");
  });

  it("requires the window to close after it opens", () => {
    expect(validateSubmissionWindow("2026-12-01T10:00", "2026-11-30T10:00")).toMatch(/close after/);
    expect(validateSubmissionWindow("2026-12-01T10:00", "2026-12-01T10:00")).toMatch(/close after/);
    expect(validateSubmissionWindow("2026-12-01T10:00", "2026-12-01T10:01")).toBeNull();
    expect(validateSubmissionWindow("", "")).toBeNull();
    expect(validateSubmissionWindow("2026-12-01T10:00", "")).toBeNull();
    expect(validateSubmissionWindow("garbage", "2026-12-01T10:00")).toMatch(/opening time is invalid/);
    expect(validateSubmissionWindow("2026-12-01T10:00", "garbage")).toMatch(/closing time is invalid/);
  });

  it("buildApiPayload sends absolute instants and a trimmed name", () => {
    const payload = buildApiPayload({
      ...INITIAL_WIZARD_EVENT,
      event_name: "  QA wizard  ",
      event_date: "2026-12-01",
      location: "Online",
      submission_time_start: "2026-12-01T10:00",
      submission_time_cutoff: "2026-12-02T10:00",
    });
    expect(payload.event.event_name).toBe("QA wizard");
    expect(payload.event.submission_time_start).toBe("2026-12-01T18:00:00.000Z");
    expect(payload.event.submission_time_cutoff).toBe("2026-12-02T18:00:00.000Z");
  });
});
