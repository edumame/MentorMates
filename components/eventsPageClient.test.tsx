import { fireEvent, render, screen } from "@testing-library/react";
import { EventsPageClient } from "./eventsPageClient";

const mockUseAuth = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/events/events-list", () => ({
  EventsList: ({ events }: { events: Array<{ event_name: string }> }) => (
    <div data-testid="events-list">{events.map((event) => event.event_name).join(",")}</div>
  ),
}));


describe("EventsPageClient", () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
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

    // Header create CTA only on Discover empty state; Hosting empty state adds a second.
    expect(
      screen.getByRole("button", { name: "Create an event" })
    ).toBeInTheDocument();
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

  it("does not use negative top margin on the authenticated sticky header", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    const { container } = render(
      <EventsPageClient
        eventsList={[]}
        initialIsAuthenticated={true}
      />
    );

    const stickyHeader = container.querySelector(".sticky");
    expect(stickyHeader).toBeTruthy();
    expect(stickyHeader?.className).toContain("pt-[24px]");
    expect(stickyHeader?.className).not.toContain("-mt-[24px]");
  });

  it("opens the creation chat from the create action", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <EventsPageClient
        eventsList={[]}
        initialIsAuthenticated={true}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Create an event" })[0]);
    expect(mockPush).toHaveBeenCalledWith("/events/new");
  });
});
