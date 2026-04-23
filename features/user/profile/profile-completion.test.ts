import {
  getMissingProfileFieldLabels,
  profileNeedsCompletion,
} from "./profile-completion";

describe("profileNeedsCompletion", () => {
  it("returns true when profile is missing", () => {
    expect(profileNeedsCompletion(null)).toBe(true);
    expect(profileNeedsCompletion(undefined)).toBe(true);
  });

  it("returns false when affiliation, phone, and LinkedIn are set", () => {
    expect(
      profileNeedsCompletion({
        affiliation: "ACME",
        phone_number: "+1 555",
        links: { linkedin: "https://linkedin.com/in/me" },
      })
    ).toBe(false);
  });

  it("returns true if any required field is empty", () => {
    expect(
      profileNeedsCompletion({
        affiliation: "",
        phone_number: "1",
        links: { linkedin: "https://linkedin.com/in/me" },
      })
    ).toBe(true);
    expect(
      profileNeedsCompletion({
        affiliation: "School",
        phone_number: "",
        links: { linkedin: "https://linkedin.com/in/me" },
      })
    ).toBe(true);
    expect(
      profileNeedsCompletion({
        affiliation: "School",
        phone_number: "1",
        links: {},
      })
    ).toBe(true);
  });
});

describe("getMissingProfileFieldLabels", () => {
  it("lists missing fields", () => {
    expect(getMissingProfileFieldLabels(null)).toEqual([
      "affiliation",
      "phone number",
      "LinkedIn",
    ]);
    expect(
      getMissingProfileFieldLabels({
        affiliation: "X",
        phone_number: "1",
        links: {},
      })
    ).toEqual(["LinkedIn"]);
  });
});
