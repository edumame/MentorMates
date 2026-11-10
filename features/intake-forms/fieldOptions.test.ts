import {
  getBlankOptionError,
  getSelectableOptions,
  isSelectFieldWithoutOptions,
} from "./fieldOptions";
import type { IntakeFormField } from "./types";

function makeField(overrides: Partial<IntakeFormField>): IntakeFormField {
  return {
    id: "f1",
    key: "k",
    type: "single_select",
    label: "Colour",
    required: true,
    ...overrides,
  };
}

describe("getSelectableOptions", () => {
  it("drops empty and whitespace-only options and keeps the rest as written", () => {
    expect(getSelectableOptions({ options: ["A", "", "  ", " B "] })).toEqual([
      "A",
      " B ",
    ]);
  });

  it("treats missing options as an empty list", () => {
    expect(getSelectableOptions({})).toEqual([]);
  });
});

describe("isSelectFieldWithoutOptions", () => {
  it("is true only for select fields with nothing to choose", () => {
    expect(isSelectFieldWithoutOptions(makeField({ options: [""] }))).toBe(true);
    expect(
      isSelectFieldWithoutOptions(makeField({ type: "multi_select", options: [] }))
    ).toBe(true);
    expect(isSelectFieldWithoutOptions(makeField({ options: ["A"] }))).toBe(false);
    expect(isSelectFieldWithoutOptions(makeField({ type: "short_text" }))).toBe(
      false
    );
  });
});

describe("getBlankOptionError", () => {
  it.each(["single_select", "multi_select"] as const)(
    "names the %s question holding a blank option",
    (type) => {
      expect(
        getBlankOptionError({ fields: [makeField({ type, options: ["A", " "] })] })
      ).toContain('"Colour"');
    }
  );

  it("handles an unlabelled question", () => {
    expect(
      getBlankOptionError({ fields: [makeField({ label: " ", options: [""] })] })
    ).toContain("A question");
  });

  it("rejects non-string options, which the routes do not type-check", () => {
    expect(
      getBlankOptionError({ fields: [{ ...makeField({}), options: [null] }] })
    ).not.toBeNull();
  });

  it("ignores valid schemas, non-select fields and malformed input", () => {
    expect(
      getBlankOptionError({ fields: [makeField({ options: ["A", "B"] })] })
    ).toBeNull();
    expect(
      getBlankOptionError({
        fields: [makeField({ type: "short_text", options: [""] })],
      })
    ).toBeNull();
    expect(getBlankOptionError({ fields: [null] })).toBeNull();
    expect(getBlankOptionError(undefined)).toBeNull();
  });
});
