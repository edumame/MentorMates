// Types for the mentor time booking feature (issue #704).

export enum BookingStatus {
  Confirmed = "confirmed",
  Cancelled = "cancelled",
}

export interface MentorAvailability {
  id: string;
  mentor_id: string;
  event_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  max_bookings: number;
  created_at: string;
  /** Set when the slot was cancelled (soft delete keeps its booking history). */
  cancelled_at?: string | null;
}

export interface MentorBooking {
  id: string;
  availability_id: string;
  participant_id: string;
  status: BookingStatus;
  booked_at: string;
}

export interface MentorProfileLite {
  uid: string;
  display_name: string | null;
  /** Not returned by the availability API (MENT-002). */
  email?: string | null;
  avatar_url: string | null;
}

export interface UserProfileLite {
  display_name: string | null;
  email: string | null;
  /** Present for viewers who may cancel this attendee's booking. */
  booking_id?: string;
}

export interface MentorAvailabilityWithBookings extends MentorAvailability {
  mentor?: MentorProfileLite | null;
  participants: UserProfileLite[];
  booking_count: number;
  // Set when the viewing participant has an active booking for this slot.
  viewer_booking_id?: string | null;
}

export interface MentorBookingWithSlot extends MentorBooking {
  availability: MentorAvailability & {
    mentor?: MentorProfileLite | null;
  };
}
