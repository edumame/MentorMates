import { render, screen } from "@testing-library/react";
import { RoleBanner } from "./role-banner";
import { EventRole } from "@/lib/types";

test("keeps custom role capitalization in desktop and mobile banners", () => {
  render(<RoleBanner actualRole={EventRole.Participant} activeRole={EventRole.Participant}
    onRoleChange={jest.fn()} eventRoleLabels={{ participant: "AI Builder" }} />);
  expect(screen.getAllByText("You are participating in this event as a AI Builder")).toHaveLength(2);
});

test("keeps custom capitalization while previewing another role", () => {
  render(<RoleBanner actualRole={EventRole.Organizer} activeRole={EventRole.Judge}
    onRoleChange={jest.fn()} eventRoleLabels={{ judge: "Technical Reviewer" }} />);
  expect(screen.getAllByText("You are viewing this event as Technical Reviewer")).toHaveLength(2);
  expect(screen.getByText("View as Technical Reviewer")).toBeInTheDocument();
});

test("hides Cancel registration for organizers and admins (EVT-ORG-001)", () => {
  const { rerender } = render(<RoleBanner actualRole={EventRole.Organizer} activeRole={EventRole.Organizer}
    onRoleChange={jest.fn()} onCancelRegistration={jest.fn()} />);
  expect(screen.queryByText("Cancel registration")).not.toBeInTheDocument();
  rerender(<RoleBanner actualRole={EventRole.Admin} activeRole={EventRole.Participant}
    onRoleChange={jest.fn()} onCancelRegistration={jest.fn()} />);
  expect(screen.queryByText("Cancel registration")).not.toBeInTheDocument();
});

test("shows Cancel registration for participants", () => {
  render(<RoleBanner actualRole={EventRole.Participant} activeRole={EventRole.Participant}
    onRoleChange={jest.fn()} onCancelRegistration={jest.fn()} />);
  expect(screen.getByText("Cancel registration")).toBeInTheDocument();
});
