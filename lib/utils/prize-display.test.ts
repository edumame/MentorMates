import { formatPrizeDisplay } from "./prize-display";

describe("formatPrizeDisplay", () => {
  it("shows the amount as the title and the description once underneath", () => {
    const description =
      "Each member of the winning team will get 1000 sun coins for their premium account.";
    expect(formatPrizeDisplay("1000HKD", description)).toEqual({
      title: "1000HKD",
      subtitle: description,
    });
  });

  it("falls back to a placeholder when both fields are empty", () => {
    expect(formatPrizeDisplay("", "")).toEqual({
      title: "Prize details coming soon",
      subtitle: "",
    });
    expect(formatPrizeDisplay(null, undefined)).toEqual({
      title: "Prize details coming soon",
      subtitle: "",
    });
    expect(formatPrizeDisplay("   ", "  ")).toEqual({
      title: "Prize details coming soon",
      subtitle: "",
    });
  });

  it("uses the description as the title when there is no amount", () => {
    expect(formatPrizeDisplay("", "Mentorship session")).toEqual({
      title: "Mentorship session",
      subtitle: "",
    });
  });

  it("shows only the amount when there is no description", () => {
    expect(formatPrizeDisplay(" $500 ", "")).toEqual({ title: "$500", subtitle: "" });
  });

  it.each([
    ["$500", "$500 cash prize", "cash prize"],
    ["$500", "$500 - cash prize", "cash prize"],
    ["$500", "$500: cash prize", "cash prize"],
    ["$500", "$500 — cash prize", "cash prize"],
    ["1000hkd", "1000HKD cash", "cash"],
  ])("drops a repeated amount from the start of the description (%s / %s)", (amount, description, subtitle) => {
    expect(formatPrizeDisplay(amount, description)).toEqual({ title: amount, subtitle });
  });

  it("shows no subtitle when the description just repeats the amount", () => {
    expect(formatPrizeDisplay("$500", "$500")).toEqual({ title: "$500", subtitle: "" });
  });

  it("keeps a description that only mentions the amount later on", () => {
    expect(formatPrizeDisplay("$500", "Cash prize of $500")).toEqual({
      title: "$500",
      subtitle: "Cash prize of $500",
    });
  });
});
