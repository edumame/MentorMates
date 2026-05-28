import { render, screen } from "@testing-library/react";
import { EventCard } from "./event-card";
import { EventRole } from "@/lib/types";

describe("EventCard", () => {
  it("renders the card as a single link", () => {
    const { container } = render(
      <EventCard
        event={{
          event_id: "event-123",
          slug: "spring-showcase",
          event_name: "Spring Showcase",
          event_date: "2026-05-10T14:00:00.000Z",
          location: "New York, NY",
          event_description: "Demo day for student builders.",
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /spring showcase/i })
    ).toHaveAttribute("href", "/events/spring-showcase/overview");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("links out to the external URL in a new tab when redirects are enabled", () => {
    render(
      <EventCard
        event={{
          event_id: "event-456",
          slug: "partner-event",
          event_name: "Partner Hackathon",
          event_date: "2026-06-01T14:00:00.000Z",
          location: "Online",
          event_description: "Hosted on a partner site.",
          external_url: "https://partner.example.com/hack",
          external_redirect_enabled: true,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "https://partner.example.com/hack");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps external-link events internal by default", () => {
    render(
      <EventCard
        event={{
          event_id: "event-456",
          slug: "partner-event",
          event_name: "Partner Hackathon",
          event_date: "2026-06-01T14:00:00.000Z",
          location: "Online",
          event_description: "Hosted on a partner site.",
          external_url: "https://partner.example.com/hack",
          userRole: EventRole.Participant,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "/events/partner-event/overview");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("keeps external-link events internal for organizers", () => {
    render(
      <EventCard
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

  it("keeps external-link events internal when redirects are disabled", () => {
    render(
      <EventCard
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

  it("falls back to the internal route when external_url is blank", () => {
    render(
      <EventCard
        event={{
          event_id: "event-789",
          slug: "internal-event",
          event_name: "Internal Event",
          event_date: "2026-06-02T14:00:00.000Z",
          location: "Online",
          event_description: "Normal MentorMates event.",
          external_url: "   ",
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /internal event/i })
    ).toHaveAttribute("href", "/events/internal-event/overview");
  });
});
