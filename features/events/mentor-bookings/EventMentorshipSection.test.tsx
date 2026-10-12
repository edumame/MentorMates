import { render, screen, waitFor } from "@testing-library/react";
import { EventMentorshipSection } from "./EventMentorshipSection";
import { EventRole } from "@/lib/types";

jest.mock("./MentorAvailabilityManager", () => ({
  MentorAvailabilityManager: () => <div>Availability manager</div>,
}));

jest.mock("./MentorBookingManager", () => ({
  MentorBookingManager: () => <div>Booking manager</div>,
}));

describe("EventMentorshipSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("shows mentor availability controls for mentors", () => {
    render(
      <EventMentorshipSection
        eventId="event-1"
        role={EventRole.Mentor}
        hasJoined
      />
    );

    expect(screen.getByText("Mentor Availability")).toBeInTheDocument();
    expect(screen.getByText("Availability manager")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows mentor booking controls for participants when bookings are open", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        availability: [
          {
            id: "slot-1",
            mentor_id: "mentor-1",
            event_id: "event-1",
            start_time: "2099-04-18T14:00:00.000Z",
            end_time: "2099-04-18T15:00:00.000Z",
            max_bookings: 1,
            created_at: "2099-04-18T12:00:00.000Z",
            booking_count: 0,
            viewer_booking_id: null,
            mentor: null,
          },
        ],
      }),
    });

    render(
      <EventMentorshipSection
        eventId="event-1"
        role={EventRole.Participant}
        hasJoined
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mentor Sessions")).toBeInTheDocument();
    });
    expect(screen.getByText("Booking manager")).toBeInTheDocument();
  });

  it("stays hidden for participants when no mentor bookings are open", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        availability: [
          {
            id: "slot-1",
            mentor_id: "mentor-1",
            event_id: "event-1",
            start_time: "2026-04-18T10:00:00.000Z",
            end_time: "2026-04-18T11:00:00.000Z",
            max_bookings: 1,
            created_at: "2026-04-18T09:00:00.000Z",
            booking_count: 1,
            viewer_booking_id: null,
            mentor: null,
          },
        ],
      }),
    });

    render(
      <EventMentorshipSection
        eventId="event-1"
        role={EventRole.Participant}
        hasJoined
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/event-1/mentor-availability",
        { cache: "no-store" }
      );
    });

    expect(screen.queryByText("Mentor Sessions")).not.toBeInTheDocument();
  });
});
