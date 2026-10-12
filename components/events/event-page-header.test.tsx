import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("./join-event-button", () => ({
  JoinEventButton: () => null,
}));
jest.mock("@/features/events/rsvp/RsvpButton", () => ({
  RsvpButton: () => null,
}));
jest.mock("@/features/events/post-survey/PostSurveyButton", () => ({
  PostSurveyButton: () => null,
}));

import { EventPageHeader } from "./event-page-header";
import { EventRole } from "@/lib/types";

const baseProps = {
  eventName: "Spring Showcase",
  eventBlurb: "Demo day for student builders.",
  eventDate: "2026-05-10T14:00:00.000Z",
  location: "New York, NY",
  eventId: "event-123",
  hasJoined: true,
  paid: false,
  eventType: ["Hackathon"],
};

describe("EventPageHeader — Edit Event button (#779)", () => {
  it("renders 'Edit event' button for organizer when onEditEventClick is provided", () => {
    render(
      <EventPageHeader
        {...baseProps}
        userRole={EventRole.Organizer}
        onManageEventClick={() => {}}
        onEditEventClick={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /edit event/i })
    ).toBeInTheDocument();
  });

  it("renders 'Edit event' button for admin", () => {
    render(
      <EventPageHeader
        {...baseProps}
        userRole={EventRole.Admin}
        onManageEventClick={() => {}}
        onEditEventClick={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /edit event/i })
    ).toBeInTheDocument();
  });

  it("does NOT render 'Edit event' for participant", () => {
    render(
      <EventPageHeader
        {...baseProps}
        userRole={EventRole.Participant}
        onManageEventClick={() => {}}
        onEditEventClick={() => {}}
      />
    );
    expect(
      screen.queryByRole("button", { name: /edit event/i })
    ).not.toBeInTheDocument();
  });

  it("calls onEditEventClick when clicked", async () => {
    const onEdit = jest.fn();
    render(
      <EventPageHeader
        {...baseProps}
        userRole={EventRole.Organizer}
        onManageEventClick={() => {}}
        onEditEventClick={onEdit}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /edit event/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("omits 'Edit event' button when onEditEventClick is not provided (back-compat)", () => {
    render(
      <EventPageHeader
        {...baseProps}
        userRole={EventRole.Organizer}
        onManageEventClick={() => {}}
      />
    );
    expect(
      screen.queryByRole("button", { name: /edit event/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage event/i })
    ).toBeInTheDocument();
  });
});
