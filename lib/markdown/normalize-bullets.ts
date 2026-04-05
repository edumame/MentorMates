/**
 * Normalize Unicode bullet characters (•, ●, ·, ‣) into proper markdown list syntax.
 *
 * Event descriptions pasted from Google Docs, Notion, or similar often use the Unicode
 * bullet character `•` to denote list items. ReactMarkdown only recognizes `-`, `*`, or
 * `+` as list markers, so these render as inline text instead of proper bullet lists.
 *
 * This helper transforms sequences like:
 *   "WHAT TO EXPECT • item one • item two • item three"
 * into:
 *   "WHAT TO EXPECT\n\n- item one\n- item two\n- item three"
 */
export function normalizeBullets(text: string | null | undefined): string {
  if (!text) return "";

  // Unicode bullet characters to normalize
  const bulletRegex = /\s*[•●‣·]\s+/g;

  // If the text contains no bullets, return as-is
  if (!bulletRegex.test(text)) return text;

  // Reset the regex (test() advances lastIndex on global regexes)
  bulletRegex.lastIndex = 0;

  // Split lines so we only transform within a single logical block
  const lines = text.split(/\r?\n/);

  const transformedLines = lines.map((line) => {
    // Skip lines that don't have bullets
    if (!/[•●‣·]/.test(line)) return line;

    // Split on bullets and normalize each segment
    // "WHAT TO EXPECT • a • b • c" → ["WHAT TO EXPECT", "a", "b", "c"]
    const parts = line.split(bulletRegex).map((s) => s.trim()).filter(Boolean);

    if (parts.length <= 1) return line;

    // First part might be a header/label (no bullet before it), keep it as a paragraph
    // followed by the list items
    const [first, ...items] = parts;
    const bullets = items.map((item) => `- ${item}`).join("\n");

    return `${first}\n\n${bullets}`;
  });

  return transformedLines.join("\n");
}
