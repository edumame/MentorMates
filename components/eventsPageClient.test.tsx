import { render, screen } from "@testing-library/react";
import { EventsPageClient } from "./eventsPageClient";

const mockUseAuth = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock("@/components/events/events-list", () => ({
  EventsList: ({ events }: { events: Array<{ event_name: string }> }) => (
    <div data-testid="events-list">{events.map((event) => event.event_name).join(",")}</div>
  ),
}));

jest.mock("@/components/events/create-event-modal", () => ({
  CreateEventModal: ({ open }: { open: boolean }) =>
    open ? <div>Create event modal</div> : null,
}));

describe("EventsPageClient", () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("uses the server auth state while the client auth context is still loading", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <EventsPageClient
        eventsList={[]}
        initialIsAuthenticated={true}
      />
    );

    expect(
      screen.getAllByRole("button", { name: "Create an event" })
    ).toHaveLength(2);
  });

  it("hides the create action for signed-out renders", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <EventsPageClient
        eventsList={[]}
        initialIsAuthenticated={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Create an event" })
    ).not.toBeInTheDocument();
  });
});
