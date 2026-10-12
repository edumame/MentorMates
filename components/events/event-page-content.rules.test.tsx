import { render, screen } from "@testing-library/react";
import { EventPageContent } from "@/components/events/event-page-content";
import type { EventDetails } from "@/lib/types";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
jest.mock("@/components/markdown/plugins", () => ({
  markdownRehypePlugins: [],
  markdownRemarkPlugins: [],
}));
jest.mock("@/components/markdown/custom-components", () => ({
  customMarkdownComponents: {},
}));
jest.mock("@/features/user/dashboards/dashboard/judge-dashboard", () => ({
  JudgeDashboard: () => null,
}));
jest.mock("@/components/events/user-project-section", () => ({
  UserProjectSection: () => null,
}));
jest.mock("@/features/events/mentor-bookings/EventMentorshipSection", () => ({
  EventMentorshipSection: () => null,
}));
jest.mock("@/components/events/ActiveRoleContext", () => ({
  useActiveRole: () => ({ activeRole: "participant" }),
}));

const event = {
  event_id: "e1",
  event_name: "Building from the Farm",
  event_description: "",
  rules: [
    { title: "Eligibility", items: ["Students"] },
    { title: "Build", items: ["Build it"] },
    { title: "Judging", items: ["Judged"] },
  ],
} as unknown as EventDetails;

describe("EventPageContent rules card", () => {
  it("renders every rule title", () => {
    render(<EventPageContent event={event} tracks={[]} hasJoined={false} />);
    for (const title of ["Eligibility", "Build", "Judging"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("keeps the card's vertical padding tight so the first and last rows sit 16px from the border", () => {
    render(<EventPageContent event={event} tracks={[]} hasJoined={false} />);
    const card = screen.getByText("Eligibility").closest("div.rounded-xl");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("px-4", "py-1");
    expect(card).not.toHaveClass("py-5");
  });
});
