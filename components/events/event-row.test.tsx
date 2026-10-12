import { render, screen } from "@testing-library/react";
import { EventRole } from "@/lib/types";
import { EventRow } from "./event-row";

describe("EventRow", () => {
  it("links external events out for non-manager roles when redirects are enabled", () => {
    render(
      <EventRow
        event={{
          event_id: "event-456",
          slug: "partner-event",
          event_name: "Partner Hackathon",
          event_date: "2026-06-01T14:00:00.000Z",
          location: "Online",
          event_description: "Hosted on a partner site.",
          external_url: "https://partner.example.com/hack",
          external_redirect_enabled: true,
          userRole: EventRole.Participant,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "https://partner.example.com/hack");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps external events internal for organizers", () => {
    render(
      <EventRow
        event={{
          event_id: "event-456",
          slug: "partner-event",
          event_name: "Partner Hackathon",
          event_date: "2026-06-01T14:00:00.000Z",
          location: "Online",
          event_description: "Hosted on a partner site.",
          external_url: "https://partner.example.com/hack",
          userRole: EventRole.Organizer,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "/events/partner-event/overview");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("keeps external events internal when redirects are disabled", () => {
    render(
      <EventRow
        event={{
          event_id: "event-456",
          slug: "partner-event",
          event_name: "Partner Hackathon",
          event_date: "2026-06-01T14:00:00.000Z",
          location: "Online",
          event_description: "Hosted on a partner site.",
          external_url: "https://partner.example.com/hack",
          external_redirect_enabled: false,
          userRole: EventRole.Participant,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "/events/partner-event/overview");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });
});
