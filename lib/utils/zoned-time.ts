import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * The one local-time → UTC conversion for event times (ORG-015), shared by
 * the create-event wizard and the Edit Event DateTimePicker.
 *
 * - Nonexistent local times (inside a spring-forward DST gap, e.g.
 *   2026-03-08 02:30 in America/Los_Angeles) are rejected with a message
 *   instead of silently shifting by an hour.
 * - Ambiguous local times (fall-back overlap, e.g. 2026-11-01 01:30 in Los
 *   Angeles) resolve to the earlier instant (the first occurrence).
 */
export type ZonedConversion =
  | { ok: true; iso: string; ambiguous: boolean }
  | { ok: false; error: string };

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const HOUR_MS = 3600_000;

export function zonedLocalToUtc(local: string, timeZone: string): ZonedConversion {
  const match = LOCAL_DATE_TIME.exec(local.trim());
  if (!match) return { ok: false, error: "Enter a valid date and time." };
  const [, y, mo, d, h, mi, s = "00"] = match;
  const normalized = `${y}-${mo}-${d}T${h}:${mi}:${s}`;

  let guess: Date;
  try {
    guess = fromZonedTime(normalized, timeZone);
  } catch {
    return { ok: false, error: "Unknown time zone." };
  }
  if (Number.isNaN(guess.getTime())) return { ok: false, error: "Enter a valid date and time." };

  // Every instant within ±1h of the guess that shows this wall-clock time.
  const matches = [-HOUR_MS, 0, HOUR_MS]
    .map((delta) => new Date(guess.getTime() + delta))
    .filter((candidate) => formatInTimeZone(candidate, timeZone, "yyyy-MM-dd'T'HH:mm:ss") === normalized);

  if (matches.length === 0) {
    return {
      ok: false,
      error: `${h}:${mi} on ${y}-${mo}-${d} does not exist in ${timeZone} (clocks skip forward for daylight saving). Choose another time.`,
    };
  }
  const earliest = matches.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
  return { ok: true, iso: earliest.toISOString(), ambiguous: matches.length > 1 };
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
