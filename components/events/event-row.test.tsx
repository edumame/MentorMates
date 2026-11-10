import { ApprovalStatus } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import { EventRole } from "@/lib/types";
import { EventRow } from "./event-row";
import { useLinkStatus } from "next/link";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
  useLinkStatus: jest.fn(() => ({ pending: false })),
}));

describe("EventRow", () => {
  beforeEach(() => jest.mocked(useLinkStatus).mockReturnValue({ pending: false }));

  it("announces pending internal navigation and clears feedback when navigation settles", () => {
    const event = {
      event_id: "event-456",
      slug: "partner-event",
      event_name: "Partner Hackathon",
      event_date: "2026-06-01T14:00:00.000Z",
      location: "Online",
    };
    const { rerender } = render(<EventRow event={event} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    jest.mocked(useLinkStatus).mockReturnValue({ pending: true });
    rerender(<EventRow event={event} />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening event…");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/events/partner-event/overview");
    jest.mocked(useLinkStatus).mockReturnValue({ pending: false });
    rerender(<EventRow event={event} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

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
          approval_status: ApprovalStatus.Approved,
          userRole: EventRole.Participant,
        }}
      />
    );

    const link = screen.getByRole("link", { name: /partner hackathon/i });
    expect(link).toHaveAttribute("href", "https://partner.example.com/hack");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
