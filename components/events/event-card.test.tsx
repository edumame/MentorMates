import { render, screen } from "@testing-library/react";
import { EventCard } from "./event-card";

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
});
