import { normalizeBullets } from "./normalize-bullets";

describe("normalizeBullets", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeBullets(null)).toBe("");
    expect(normalizeBullets(undefined)).toBe("");
    expect(normalizeBullets("")).toBe("");
  });

  it("leaves text without bullets unchanged", () => {
    const text = "Just a normal paragraph without any bullets.";
    expect(normalizeBullets(text)).toBe(text);
  });

  it("converts inline bullets after a header into a markdown list", () => {
    const input = "WHAT TO EXPECT • Hosted in SF • Full day • $5K prizes";
    const output = normalizeBullets(input);
    expect(output).toBe(
      "WHAT TO EXPECT\n\n- Hosted in SF\n- Full day\n- $5K prizes"
    );
  });

  it("handles multiple Unicode bullet characters", () => {
    const input = "Header ● item one ● item two";
    expect(normalizeBullets(input)).toBe("Header\n\n- item one\n- item two");
  });

  it("preserves line structure for multi-line input", () => {
    const input =
      "First line without bullets.\nSection • a • b\nAnother line.";
    const output = normalizeBullets(input);
    expect(output).toContain("First line without bullets.");
    expect(output).toContain("Section\n\n- a\n- b");
    expect(output).toContain("Another line.");
  });

  it("does not double-process already-formatted markdown lists", () => {
    const input = "Header\n\n- a\n- b\n- c";
    expect(normalizeBullets(input)).toBe(input);
  });
});
