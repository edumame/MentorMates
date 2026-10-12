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
