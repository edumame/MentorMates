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
