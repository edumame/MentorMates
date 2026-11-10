import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

export function hasOpenMentorBookings(
  slots: MentorAvailabilityWithBookings[],
  now = Date.now()
) {
  return slots.some((slot) => {
    const endsAt = new Date(slot.end_time).getTime();
    const hasCapacity = slot.booking_count < slot.max_bookings;

    return Boolean(slot.viewer_booking_id) || (endsAt > now && hasCapacity);
  });
}

// ---- Slot rules shared by the availability API and form (MENT-003) ----

export const MAX_SLOT_DURATION_MS = 8 * 60 * 60 * 1000;
/** Mentoring may start a little before submissions open and run past cutoff. */
export const EVENT_WINDOW_BUFFER_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SLOT_DURATION_MS = 60 * 60 * 1000;

export interface EventWindow {
  start: string | null | undefined;
  end: string | null | undefined;
}

/** Returns a user-facing error, or null when the slot is acceptable. */
export function validateSlotTimes(
  startIso: string,
  endIso: string,
  window: EventWindow,
  now = Date.now()
): string | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Invalid start or end time";
  if (end <= start) return "End time must be after start time";
  if (end <= now) return "This slot is already in the past";
  if (end - start > MAX_SLOT_DURATION_MS) {
    return "Slots can be at most 8 hours long. Add several shorter slots instead.";
  }
  const windowStart = window.start ? new Date(window.start).getTime() : NaN;
  const windowEnd = window.end ? new Date(window.end).getTime() : NaN;
  if (!Number.isNaN(windowStart) && start < windowStart - EVENT_WINDOW_BUFFER_MS) {
    return "This slot starts well before the event";
  }
  if (!Number.isNaN(windowEnd) && end > windowEnd + EVENT_WINDOW_BUFFER_MS) {
    return "This slot ends well after the event";
  }
  return null;
}

/**
 * Suggested form default: a one-hour slot starting at the next full hour,
 * moved forward to the event window start when that is later.
 */
export function defaultSlotWindow(
  window: EventWindow,
  now = new Date()
): { start: Date; end: Date } {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const windowStart = window.start ? new Date(window.start) : null;
  const start =
    windowStart && !Number.isNaN(windowStart.getTime()) && windowStart > nextHour
      ? windowStart
      : nextHour;
  return { start, end: new Date(start.getTime() + DEFAULT_SLOT_DURATION_MS) };
}

const slotFormatter = (timeZone?: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });

/**
 * "Nov 9, 2026, 3:00 PM – 4:00 PM PST": no seconds, date shown once when the
 * slot is within a day, and the viewer's time zone labelled (MENT-007).
 */
export function formatSlotRange(
  startIso: string,
  endIso: string,
  timeZone?: string
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatter = slotFormatter(timeZone);
  const range =
    typeof formatter.formatRange === "function"
      ? formatter.formatRange(start, end)
      : `${formatter.format(start)} – ${formatter.format(end)}`;
  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short", timeZone })
      .formatToParts(start)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  return zone ? `${range} ${zone}` : range;
}
