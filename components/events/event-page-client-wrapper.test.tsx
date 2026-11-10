import { render, screen } from "@testing-library/react";
import { EventRole } from "@/lib/types";
import { EventPageClientWrapper } from "./event-page-client-wrapper";

let mockPathname = "/events/e1/overview";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("./organizer-edit-overview", () => ({ OrganizerEditOverview: () => <div>organizer dashboard</div> }));
jest.mock("./event-page-header", () => ({ EventPageHeader: () => <div>header</div> }));
jest.mock("./ActiveRoleContext", () => ({ useActiveRole: () => ({ activeRole: null, setActiveRole: jest.fn() }) }));

const renderWrapper = (userRole: EventRole) =>
  render(
    <EventPageClientWrapper
      userRole={userRole}
      eventId="e1"
      eventName="E"
      eventBlurb=""
      eventDate=""
      location=""
      displayEventId="e1"
      hasJoined
      paid={false}
      eventType={["Hackathon"]}
      tabsAndContent={<div>route content</div>}
    />
  );

describe("EventPageClientWrapper", () => {
  it("shows the organizer dashboard without a cancel-registration action (EVT-ORG-001)", () => {
    mockPathname = "/events/e1/overview";
    renderWrapper(EventRole.Organizer);
    expect(screen.getByText("organizer dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Cancel registration")).not.toBeInTheDocument();
  });

  it("renders the voting route content for organizers (JUDGE-018)", () => {
    mockPathname = "/events/e1/voting";
    renderWrapper(EventRole.Organizer);
    expect(screen.getByText("route content")).toBeInTheDocument();
    expect(screen.queryByText("organizer dashboard")).not.toBeInTheDocument();
  });

  it("offers cancel registration to participants", () => {
    mockPathname = "/events/e1/overview";
    renderWrapper(EventRole.Participant);
    expect(screen.getByText("Cancel registration")).toBeInTheDocument();
  });
});
