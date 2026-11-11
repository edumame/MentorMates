import { fireEvent, render, screen, within } from "@testing-library/react";
import { EventsPageClient, matchesEventSearch } from "./eventsPageClient";
import type { EventWithRole } from "@/components/events/event-row";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock("@/features/user/authentication/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

// Featured cards render EventRow, whose pending indicator calls useLinkStatus.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

jest.mock("@/components/events/events-list", () => ({
  EventsList: ({ events }: { events: Array<{ event_name: string }> }) => (
    <div data-testid="events-list">{events.map((event) => event.event_name).join(",")}</div>
  ),
}));

// The desktop rows duplicate the EventsList content; the list mock is what
// these tests read.
jest.mock("@/components/events/event-row", () => ({
  EventRow: () => null,
}));

jest.mock("@/components/events/create-event-modal", () => ({
  CreateEventModal: ({ open }: { open: boolean }) =>
    open ? <div>Create event modal</div> : null,
}));

const makeEvent = (
  name: string,
  overrides: Partial<EventWithRole> = {}
): EventWithRole =>
  ({
    event_id: name,
    event_name: name,
    event_date: "2099-06-01",
    visibility: EventVisibility.Public,
    approval_status: ApprovalStatus.Approved,
    userRole: null,
    ...overrides,
  }) as EventWithRole;

const listedEvents = () =>
  screen
    .queryAllByTestId("events-list")
    .flatMap((list) => (list.textContent ?? "").split(","))
    .filter(Boolean);

const openTab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

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

  describe("tabs", () => {
    const publicEvent = makeEvent("Public hackathon", {
      event_type: ["hackathon"],
    });
    const hostedDraft = makeEvent("Hosted draft", {
      visibility: EventVisibility.Draft,
      approval_status: ApprovalStatus.NotSubmitted,
      userRole: EventRole.Organizer,
      event_type: ["workshop"],
    });
    const hostedPendingPublic = makeEvent("Hosted pending", {
      approval_status: ApprovalStatus.Submitted,
      userRole: EventRole.Admin,
    });
    const hostedArchived = makeEvent("Hosted archived", {
      visibility: EventVisibility.Archived,
      userRole: EventRole.Organizer,
    });
    const joinedPrivate = makeEvent("Joined private", {
      visibility: EventVisibility.Private,
      userRole: EventRole.Participant,
    });
    const eventsList = [
      publicEvent,
      hostedDraft,
      hostedPendingPublic,
      hostedArchived,
      joinedPrivate,
    ];

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    });

    it("lists hosted events whatever their visibility or approval on Hosting", () => {
      render(<EventsPageClient eventsList={eventsList} initialIsAuthenticated />);

      openTab("Hosting");

      expect(listedEvents().sort()).toEqual([
        "Hosted archived",
        "Hosted draft",
        "Hosted pending",
      ]);
      expect(
        screen.queryByText("You haven't created an event yet")
      ).not.toBeInTheDocument();
    });

    it("lists joined private events on Attended", () => {
      render(<EventsPageClient eventsList={eventsList} initialIsAuthenticated />);

      openTab("Attended");

      expect(listedEvents()).toEqual(["Joined private"]);
    });

    it("keeps Discover to public approved events", () => {
      render(<EventsPageClient eventsList={eventsList} initialIsAuthenticated />);

      expect(listedEvents()).toEqual(["Public hackathon"]);
    });

    it("does not offer event types that only exist on hidden events in Discover", () => {
      render(<EventsPageClient eventsList={eventsList} initialIsAuthenticated />);

      expect(screen.getByLabelText("Hackathon")).toBeInTheDocument();
      expect(screen.queryByLabelText("Workshop")).not.toBeInTheDocument();

      openTab("Hosting");

      expect(screen.getByLabelText("Workshop")).toBeInTheDocument();
    });

    it("keeps a selected event type available after switching tabs", () => {
      render(<EventsPageClient eventsList={eventsList} initialIsAuthenticated />);

      fireEvent.click(screen.getByLabelText("Hackathon"));
      openTab("Hosting");

      expect(screen.getByLabelText("Hackathon")).toBeChecked();
    });

    it("keeps showing every event in Discover to global admins", () => {
      render(
        <EventsPageClient
          eventsList={eventsList}
          initialIsAuthenticated
          isGlobalAdmin
        />
      );

      expect(listedEvents()).toHaveLength(eventsList.length);
    });

    it("falls back to Discover contents if the session ends on a role tab", () => {
      const { rerender } = render(
        <EventsPageClient eventsList={eventsList} initialIsAuthenticated />
      );
      openTab("Hosting");

      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
      rerender(
        <EventsPageClient eventsList={eventsList} initialIsAuthenticated />
      );

      expect(listedEvents()).toEqual(["Public hackathon"]);
    });
  });

  describe("featured overflow", () => {
    const makeFeaturedEvents = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        event_id: `event-${index + 1}`,
        event_name: `Featured Event ${index + 1}`,
        // Dated descending, as app/events/page.tsx passes them.
        event_date: `2020-01-${String(28 - index).padStart(2, "0")}`,
        location: "Remote",
        featured: true,
        // Discover only lists public, approved events.
        visibility: EventVisibility.Public,
        approval_status: ApprovalStatus.Approved,
      })) as EventWithRole[];

    const renderEvents = (eventsList: EventWithRole[]) => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
      render(
        <EventsPageClient eventsList={eventsList} initialIsAuthenticated={false} />
      );
    };

    const sectionNames = (heading: string) => {
      const section = screen
        .getByRole("heading", { name: heading })
        .closest("section") as HTMLElement;
      return within(section).getByTestId("events-list").textContent?.split(",");
    };

    it("lists featured events beyond the first six in their date bucket", () => {
      renderEvents(makeFeaturedEvents(7));

      expect(sectionNames("Featured")).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => `Featured Event ${n}`)
      );
      expect(sectionNames("Past events")).toEqual(["Featured Event 7"]);
    });

    it("counts overflow featured events in pagination and reaches them with Load more", () => {
      renderEvents(makeFeaturedEvents(12));

      expect(screen.getByText(/10 of 12/)).toBeInTheDocument();
      expect(sectionNames("Past events")).toEqual(
        [7, 8, 9, 10].map((n) => `Featured Event ${n}`)
      );

      fireEvent.click(screen.getByRole("button", { name: /load more/i }));

      expect(sectionNames("Past events")).toEqual(
        [7, 8, 9, 10, 11, 12].map((n) => `Featured Event ${n}`)
      );
    });
  });
});

describe("event search (PUB-018)", () => {
  it("matches name or location, case-insensitively, ignoring surrounding spaces", () => {
    const event = { event_name: "Spring Hack Night", location: "San Francisco" };
    expect(matchesEventSearch(event, "  hack ")).toBe(true);
    expect(matchesEventSearch(event, "francisco")).toBe(true);
    expect(matchesEventSearch(event, "tokyo")).toBe(false);
    expect(matchesEventSearch({ event_name: "Online Jam", location: null }, "jam")).toBe(true);
    expect(matchesEventSearch(event, "")).toBe(true);
  });
});
