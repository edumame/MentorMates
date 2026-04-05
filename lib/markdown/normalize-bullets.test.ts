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

  // Regression: real Luma-scraped event descriptions put ONE bullet per line
  // with single \n separators. CommonMark collapses consecutive lines without
  // a blank line into one paragraph, so "• a\n• b\n• c" renders as the literal
  // string "• a • b • c" inline. The helper must convert leading-bullet lines
  // into dash markdown list items AND ensure a blank line separates the list
  // from a preceding paragraph so react-markdown recognizes it as a list.
  describe("one-bullet-per-line format (real Luma scrapes)", () => {
    it("converts leading-bullet lines into a markdown list", () => {
      const input = "WHAT TO EXPECT\n• Hosted in SF\n• Full day\n• $5K prizes";
      expect(normalizeBullets(input)).toBe(
        "WHAT TO EXPECT\n\n- Hosted in SF\n- Full day\n- $5K prizes"
      );
    });

    it("inserts blank line before the list when the previous line is a paragraph", () => {
      const input = "Header line\n• item one\n• item two";
      const output = normalizeBullets(input);
      // CommonMark requires a blank line after a paragraph before a list,
      // otherwise the list items get absorbed into the paragraph.
      expect(output).toBe("Header line\n\n- item one\n- item two");
    });

    it("does not insert an extra blank line when one already exists", () => {
      const input = "Header line\n\n• item one\n• item two";
      expect(normalizeBullets(input)).toBe(
        "Header line\n\n- item one\n- item two"
      );
    });

    it("handles multiple bullet sections separated by headers", () => {
      const input =
        "WHAT TO EXPECT\n• a\n• b\n\nPROGRAM\n• 8am\n• 9am\n• 10am";
      expect(normalizeBullets(input)).toBe(
        "WHAT TO EXPECT\n\n- a\n- b\n\nPROGRAM\n\n- 8am\n- 9am\n- 10am"
      );
    });

    it("handles trailing paragraph after a bullet section", () => {
      const input = "PROGRAM\n• 8am\n• 9am\nTeams of 1–4.";
      expect(normalizeBullets(input)).toBe(
        "PROGRAM\n\n- 8am\n- 9am\n\nTeams of 1–4."
      );
    });

    it("handles the full Agent Master event description", () => {
      const input =
        "Intro paragraph with no bullets.\n\n" +
        "WHAT TO EXPECT\n" +
        "• Hosted in the offices of Entrepreneurs First in San Francisco\n" +
        "• Full day of building and prototyping\n" +
        "• Access to tools, credits, and a strong builder network\n" +
        "• Jury of founders, investors, and operators\n" +
        "• $5K IN PRIZES\n\n" +
        "PROGRAM\n" +
        "Saturday, April 4 | Hack Day\n" +
        "• 8:30 AM – Doors open & breakfast\n" +
        "• 9:00 AM – Hacking begins\n" +
        "• 7:00 PM – Event ends\n" +
        "Teams of 1–4.";

      const output = normalizeBullets(input);

      // Every bullet gets converted to a dash list item.
      expect(output).toContain("- Hosted in the offices of Entrepreneurs First in San Francisco");
      expect(output).toContain("- $5K IN PRIZES");
      expect(output).toContain("- 8:30 AM – Doors open & breakfast");
      expect(output).toContain("- 7:00 PM – Event ends");

      // No literal bullet characters remain.
      expect(output).not.toContain("•");

      // Headers preceding lists get a blank line separator.
      expect(output).toContain("WHAT TO EXPECT\n\n- Hosted");
      expect(output).toContain("Saturday, April 4 | Hack Day\n\n- 8:30 AM");

      // Trailing paragraph after a list is separated by a blank line.
      expect(output).toContain("- 7:00 PM – Event ends\n\nTeams of 1–4.");
    });

    it("handles a line starting with a bullet followed by inline bullets", () => {
      // Edge case: "• a • b • c" on one line. All three must become list items,
      // none promoted to header.
      const input = "Header\n• a • b • c";
      expect(normalizeBullets(input)).toBe("Header\n\n- a\n- b\n- c");
    });
  });
});
