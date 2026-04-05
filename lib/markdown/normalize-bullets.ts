/**
 * Normalize Unicode bullet characters (•, ●, ·, ‣) into proper markdown list syntax.
 *
 * Event descriptions pasted or scraped from Google Docs, Notion, Luma, etc. use the
 * Unicode bullet character `•` to denote list items. ReactMarkdown only recognizes
 * `-`, `*`, or `+` as list markers, so bullet characters render as inline text.
 *
 * This helper handles BOTH common formats:
 *
 *   1. One bullet per line (Luma-style):
 *        "WHAT TO EXPECT\n• item one\n• item two\n• item three"
 *      →
 *        "WHAT TO EXPECT\n\n- item one\n- item two\n- item three"
 *
 *   2. Inline bullets on a single line (Google Docs paste):
 *        "WHAT TO EXPECT • item one • item two • item three"
 *      →
 *        "WHAT TO EXPECT\n\n- item one\n- item two\n- item three"
 *
 * It also inserts a blank line between a preceding paragraph and a list, and
 * between a list and a following paragraph — CommonMark requires this
 * separation or the list collapses back into the surrounding paragraph.
 */

const BULLET_CHARS = /[•●‣·]/;
const LEADING_BULLET = /^\s*[•●‣·]\s+/;
const BULLET_SPLIT = /\s*[•●‣·]\s+/g;

function isListItem(line: string): boolean {
  return /^- /.test(line);
}

export function normalizeBullets(text: string | null | undefined): string {
  if (!text) return "";

  // Fast path: no bullet characters anywhere, nothing to do.
  if (!BULLET_CHARS.test(text)) return text;

  // Pass 1: transform each line. Leading-bullet lines become dash list items.
  // Inline bullets (multiple bullets on a single line) also become list items,
  // with the first segment kept as a header/label unless the line itself
  // started with a bullet.
  const rawLines = text.split(/\r?\n/);
  const processedLines: string[] = [];

  for (const line of rawLines) {
    if (!BULLET_CHARS.test(line)) {
      processedLines.push(line);
      continue;
    }

    const startsWithBullet = LEADING_BULLET.test(line);
    const parts = line
      .split(BULLET_SPLIT)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      // Line was only bullet characters with no content. Drop it.
      continue;
    }

    if (startsWithBullet) {
      // Every segment is a list item; there is no header on this line.
      for (const part of parts) {
        processedLines.push(`- ${part}`);
      }
    } else if (parts.length === 1) {
      // A bullet character exists but the split produced exactly one part.
      // This means the bullet wasn't followed by whitespace (e.g. a decimal
      // like "·5"). Leave the line alone.
      processedLines.push(line);
    } else {
      // First segment is a header/label, remaining segments are list items.
      const [header, ...items] = parts;
      processedLines.push(header);
      for (const item of items) {
        processedLines.push(`- ${item}`);
      }
    }
  }

  // Pass 2: insert blank-line separators between list and non-list blocks so
  // CommonMark parsers recognize the list. A list adjacent to a paragraph
  // without a blank line is otherwise treated as lazy paragraph continuation.
  const finalLines: string[] = [];

  for (const line of processedLines) {
    const previous = finalLines[finalLines.length - 1] ?? "";
    const enteringList =
      isListItem(line) && previous !== "" && !isListItem(previous);
    const leavingList =
      !isListItem(line) && line !== "" && isListItem(previous);

    if (enteringList || leavingList) {
      finalLines.push("");
    }
    finalLines.push(line);
  }

  return finalLines.join("\n");
}
