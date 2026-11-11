import { hasOpenMentorBookings } from "./utils";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

function makeSlot(
  overrides: Partial<MentorAvailabilityWithBookings> = {}
): MentorAvailabilityWithBookings {
  return {
    id: "slot-1",
    mentor_id: "mentor-1",
    event_id: "event-1",
    start_time: "2026-04-18T14:00:00.000Z",
    end_time: "2026-04-18T15:00:00.000Z",
    max_bookings: 1,
    created_at: "2026-04-18T12:00:00.000Z",
    booking_count: 0,
    participants: [],
    viewer_booking_id: null,
    mentor: null,
    ...overrides,
  };
}

describe("hasOpenMentorBookings", () => {
  const now = new Date("2026-04-18T13:00:00.000Z").getTime();

  it("returns true when a future slot still has capacity", () => {
    expect(hasOpenMentorBookings([makeSlot()], now)).toBe(true);
  });

  it("returns true when the viewer already has a booking", () => {
    expect(
      hasOpenMentorBookings(
        [
          makeSlot({
            booking_count: 1,
            max_bookings: 1,
            viewer_booking_id: "booking-1",
          }),
        ],
        now
      )
    ).toBe(true);
  });

  it("returns false when slots are full or already over", () => {
    expect(
      hasOpenMentorBookings(
        [
          makeSlot({
            booking_count: 1,
            max_bookings: 1,
          }),
          makeSlot({
            id: "slot-2",
            start_time: "2026-04-18T10:00:00.000Z",
            end_time: "2026-04-18T11:00:00.000Z",
          }),
        ],
        now
      )
    ).toBe(false);
  });
});

import { defaultSlotWindow, formatSlotRange, validateSlotTimes } from "./utils";

describe("validateSlotTimes", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const window = { start: "2026-11-09T09:00:00Z", end: "2026-11-10T18:00:00Z" };
  it.each([
    ["2026-11-09T10:00:00Z", "2026-11-09T11:00:00Z", null],
    ["2026-11-09T10:00:00Z", "2026-11-09T10:00:00Z", /after start/],
    ["2026-11-07T10:00:00Z", "2026-11-07T11:00:00Z", /past/],
    ["2026-11-09T09:00:00Z", "2026-11-09T18:00:00Z", /8 hours/],
    ["2026-11-20T10:00:00Z", "2026-11-20T11:00:00Z", /after the event/],
    ["nope", "2026-11-20T11:00:00Z", /Invalid/],
  ])("%s -> %s", (start, end, expected) => {
    const result = validateSlotTimes(start, end, window, now);
    if (expected === null) expect(result).toBeNull();
    else expect(result).toMatch(expected);
  });
  it("allows a slot within the 24h buffer before the window", () => {
    expect(validateSlotTimes("2026-11-08T18:00:00Z", "2026-11-08T19:00:00Z", window, now)).toBeNull();
  });
});

describe("defaultSlotWindow", () => {
  it("uses the next full hour when the event already started", () => {
    const { start, end } = defaultSlotWindow({ start: "2026-01-01T00:00:00Z", end: null }, new Date("2026-11-08T12:34:00Z"));
    expect(start.toISOString()).toBe("2026-11-08T13:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(3600_000);
  });
  it("uses the event window start when it is later", () => {
    const { start } = defaultSlotWindow({ start: "2026-12-01T09:00:00Z", end: null }, new Date("2026-11-08T12:34:00Z"));
    expect(start.toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});

describe("formatSlotRange", () => {
  it("omits seconds, shows the date once and labels the time zone", () => {
    const text = formatSlotRange("2026-11-09T15:00:00Z", "2026-11-09T16:30:00Z", "UTC");
    expect(text).not.toMatch(/:00:00/);
    expect(text.match(/2026/g)).toHaveLength(1);
    expect(text).toMatch(/UTC$/);
  });
});
