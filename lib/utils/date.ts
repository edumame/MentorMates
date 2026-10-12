/**
 * Date utilities for parsing event date strings in a way that respects
 * the viewer's local timezone.
 *
 * Context: Many of our event dates are stored as date-only strings
 * (e.g., "2025-02-09"). When passed to `new Date("YYYY-MM-DD")`, the
 * JavaScript Date constructor interprets them as UTC midnight. For users
 * in negative UTC offsets (e.g., PST), this can render as the prior day.
 *
 * To avoid off-by-one issues, this parser treats plain date strings as
 * local dates by constructing the Date via (year, monthIndex, day).
 */

/**
 * Parse an event date string into a Date that represents the same calendar
 * day in the user's local timezone. Returns null for invalid inputs.
 *
 * Rules:
 * - If input matches YYYY-MM-DD, construct a local Date at local midnight.
 * - Otherwise, fall back to `new Date(input)` and validate.
 */
export function parseEventDateLocal(input?: string | null): Date | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // Strict YYYY-MM-DD (no time component)
  const dateOnlyMatch = trimmed.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1; // zero-based
    const day = Number(dateOnlyMatch[3]);
    const local = new Date(year, monthIndex, day);
    if (!Number.isNaN(local.getTime())) return local;
    return null;
  }

  // Fallback: allow full ISO or other parseable formats
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
