import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EventRole } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { EventPageClientWrapper } from "./event-page-client-wrapper";

const toast = jest.fn();
const refresh = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: "alice" } } },
      })),
    },
    from: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: jest.fn() }),
  usePathname: () => "/events/event-1/overview",
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("./ActiveRoleContext", () => ({
  useActiveRole: () => ({ activeRole: null, setActiveRole: jest.fn() }),
}));

jest.mock("./role-banner", () => ({
  RoleBanner: ({
    onCancelRegistration,
  }: {
    onCancelRegistration: () => void;
  }) => <button onClick={onCancelRegistration}>Open cancel dialog</button>,
}));

jest.mock("./event-page-header", () => ({
  EventPageHeader: () => null,
}));

jest.mock("./organizer-edit-overview", () => ({
  OrganizerEditOverview: () => null,
}));

describe("EventPageClientWrapper cancel registration", () => {
  const fetchMock = jest.fn();

  const confirmCancel = () => {
    render(
      <EventPageClientWrapper
        userRole={EventRole.Participant}
        eventId="event-1"
        eventName="Paid Event"
        eventBlurb=""
        eventDate=""
        location=""
        displayEventId="event-1"
        hasJoined
        paid
        eventType={[]}
        tabsAndContent={null}
      />,
    );

    fireEvent.click(screen.getByText("Open cancel dialog"));
    fireEvent.click(screen.getByText("Yes, cancel registration"));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("cancels through the server so a paid seat is released", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    confirmCancel();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/events/event-1/registration", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: EventRole.Participant }),
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Registration Cancelled" }),
    );
  });

  it("explains the last-organizer guard when the server reports it", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ hint: "last_organizer" }),
    });

    confirmCancel();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "An event must keep at least one organizer.",
        }),
      ),
    );
  });

  it("tells the user when the cancellation fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    confirmCancel();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
