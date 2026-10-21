import { render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { Project, ProjectBoardContext } from "@/lib/types";
import ProjectBoard from "./ProjectBoard";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const project: Project = {
  id: "project-1", project_name: "Public project", project_description: "Description",
  lead_name: "Project lead", lead_email: "", event_id: "event-1", track_ids: [],
  created_at: "2026-01-01T00:00:00Z", submitted: true,
  teammates: ["Team member 1", "Team member 2", "Team member 3", "Team member 4"],
};
const sessionFor = (email?: string) => ({ user: { email } }) as Session;
const show = (item = project, session?: Session | null) => render(
  <ProjectBoard isLoading={false} projectList={[item]} session={session}
    projectBoardContext={ProjectBoardContext.EventGallery} />
);

describe("ProjectBoard public profile data", () => {
  it.each([undefined, null, sessionFor(), sessionFor("")])(
    "never labels a visitor without an email as owner (%p)", (session) => {
      // Exercise omitted API fields as well as the page adapter's empty string.
      show({ ...project, lead_email: undefined } as unknown as Project, session);
      expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    }
  );
  it("does not label an authenticated visitor as owner of a redacted project", () => {
    show(project, sessionFor("visitor@example.com"));
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/public/project-1");
  });
  it("retains the owner badge when the authorized email matches", () => {
    show({ ...project, lead_email: "owner@example.com" }, sessionFor("owner@example.com"));
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
  it("preserves the avatar stack and overflow count with safe teammate labels", () => {
    show();
    expect(screen.getByTitle("Project lead")).toBeInTheDocument();
    [1, 2, 3].forEach((index) => expect(screen.getByTitle(`Team member ${index}`)).toBeInTheDocument());
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByTitle("Team member 4")).not.toBeInTheDocument();
  });
});
