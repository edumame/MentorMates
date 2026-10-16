import {
  getLocalizedField,
  setLocalizedField,
  getAvailableLocales,
} from "./get-localized-field";

describe("getLocalizedField", () => {
  it("returns the requested locale when present", () => {
    const row = {
      event_name: "AI Hackathon",
      event_name_i18n: { en: "AI Hackathon", zh: "AI黑客马拉松" },
    };
    expect(getLocalizedField(row, "event_name", "zh")).toBe("AI黑客马拉松");
  });

  it("falls back to en when requested locale missing", () => {
    const row = {
      event_name: "AI Hackathon",
      event_name_i18n: { en: "AI Hackathon" },
    };
    expect(getLocalizedField(row, "event_name", "es")).toBe("AI Hackathon");
  });

  it("falls back to the original column when i18n map is empty", () => {
    const row = {
      event_name: "AI Hackathon",
      event_name_i18n: {},
    };
    expect(getLocalizedField(row, "event_name", "zh")).toBe("AI Hackathon");
  });

  it("falls back to the original column when i18n map is missing", () => {
    const row = { event_name: "AI Hackathon" };
    expect(getLocalizedField(row, "event_name", "zh")).toBe("AI Hackathon");
  });

  it("returns empty string when nothing is available", () => {
    expect(getLocalizedField(null, "event_name", "zh")).toBe("");
    expect(getLocalizedField({}, "event_name", "zh")).toBe("");
  });

  it("skips empty string values in the i18n map", () => {
    const row = {
      event_name: "AI Hackathon",
      event_name_i18n: { zh: "  ", en: "AI Hackathon" },
    };
    expect(getLocalizedField(row, "event_name", "zh")).toBe("AI Hackathon");
  });
});

describe("setLocalizedField", () => {
  it("adds a new locale to an empty map", () => {
    expect(setLocalizedField({}, "zh", "AI黑客马拉松")).toEqual({
      zh: "AI黑客马拉松",
    });
  });

  it("merges with existing locales", () => {
    expect(
      setLocalizedField({ en: "AI Hackathon" }, "zh", "AI黑客马拉松")
    ).toEqual({ en: "AI Hackathon", zh: "AI黑客马拉松" });
  });

  it("removes a locale when the value is empty", () => {
    expect(
      setLocalizedField({ en: "AI Hackathon", zh: "AI黑客马拉松" }, "zh", "")
    ).toEqual({ en: "AI Hackathon" });
  });

  it("handles null existing map", () => {
    expect(setLocalizedField(null, "en", "Hello")).toEqual({ en: "Hello" });
  });
});

describe("getAvailableLocales", () => {
  it("returns locales with non-empty values", () => {
    const row = {
      event_name_i18n: { en: "AI Hackathon", zh: "AI黑客马拉松", es: "" },
    };
    expect(getAvailableLocales(row, "event_name").sort()).toEqual(["en", "zh"]);
  });

  it("returns empty array when map is missing", () => {
    expect(getAvailableLocales({}, "event_name")).toEqual([]);
    expect(getAvailableLocales(null, "event_name")).toEqual([]);
  });
});
