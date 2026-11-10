import { render, screen } from "@testing-library/react";
import { ProjectTeamMembersList, ProjectTeamSidebar } from "./ProjectTeam";
import type { ProjectTeamDisplayMember } from "@/features/projects/utils/team-display";

const members: ProjectTeamDisplayMember[] = [
  { key: "a", id: "a", displayName: "Lead Person", avatarUrl: null, affiliation: null, role: "lead", email: "lead@x.test" },
  { key: "b", id: "b", displayName: "Second", avatarUrl: null, affiliation: "Uni", role: "member", email: "b@x.test" },
  { key: "c", id: null, displayName: "Third", avatarUrl: null, affiliation: null, role: "member", email: "c@x.test" },
];

describe.each([
  ["public route", false],
  ["private route", true],
])("project team sections (%s)", (_label, showEmails) => {
  it("sidebar shows the lead and the first teammate only", () => {
    render(<ProjectTeamSidebar members={members} showEmails={showEmails} />);
    expect(screen.getByText("Meet the team")).toBeInTheDocument();
    expect(screen.getByText("Lead Person")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.queryByText("Third")).not.toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
  });

  it("team tab lists every member", () => {
    render(<ProjectTeamMembersList members={members} showEmails={showEmails} />);
    ["Lead Person", "Second", "Third"].forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
    expect(screen.getByText("Uni")).toBeInTheDocument();
  });

  it(showEmails ? "shows emails only where affiliation is missing" : "never renders an email", () => {
    const { container } = render(
      <>
        <ProjectTeamSidebar members={members} showEmails={showEmails} />
        <ProjectTeamMembersList members={members} showEmails={showEmails} />
      </>
    );
    if (showEmails) {
      expect(screen.getAllByText("lead@x.test").length).toBe(2);
      expect(screen.queryByText("b@x.test")).not.toBeInTheDocument();
    } else {
      expect(container.innerHTML).not.toMatch(/@x\.test/);
    }
  });
});
