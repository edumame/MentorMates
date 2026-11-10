/**
 * @jest-environment ./lib/test-utils/los-angeles-timezone-environment.cjs
 */
import { toDateTimeLocalValue } from "./date";

describe("toDateTimeLocalValue", () => {
  it("formats an instant in the viewer's timezone", () => {
    expect(toDateTimeLocalValue("2026-11-10T20:00:00.000Z")).toBe(
      "2026-11-10T12:00"
    );
  });

  it("uses the daylight saving offset of the formatted date", () => {
    expect(toDateTimeLocalValue("2026-07-10T19:00:00.000Z")).toBe(
      "2026-07-10T12:00"
    );
  });

  it("rolls back to the previous local day", () => {
    expect(toDateTimeLocalValue("2027-01-01T03:05:00.000Z")).toBe(
      "2026-12-31T19:05"
    );
  });

  it.each([
    "2026-11-10T12:00",
    "2026-07-10T12:00",
    "2026-03-08T01:59",
    "2026-03-08T03:00",
    "2026-11-01T00:59",
    "2026-11-01T02:00",
  ])("round-trips %s through the input's local parsing", (value) => {
    expect(toDateTimeLocalValue(new Date(value).toISOString())).toBe(value);
  });

  it("keeps a partially typed year valid for the input", () => {
    expect(
      toDateTimeLocalValue(new Date("0202-11-10T12:00").toISOString())
    ).toBe("0202-11-10T12:00");
  });

  it("returns an empty string for an invalid date", () => {
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });
});
