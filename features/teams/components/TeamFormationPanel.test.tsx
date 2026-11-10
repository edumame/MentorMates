import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeamMemberRole, TeamWithMembers } from "@/lib/types/team";
import { deleteTeamOrMember, fetchTeams } from "../api/teamsClient";
import { TeamFormationPanel } from "./TeamFormationPanel";

const mockToast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/app/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "lead" } } }),
    },
  }),
}));

jest.mock("../api/teamsClient", () => ({
  createTeam: jest.fn(),
  deleteTeamOrMember: jest.fn(),
  fetchParticipants: jest.fn().mockResolvedValue([]),
  fetchTeams: jest.fn(),
  patchTeam: jest.fn(),
}));

const mockFetchTeams = fetchTeams as jest.Mock;
const mockDelete = deleteTeamOrMember as jest.Mock;

function member(userId: string, role: TeamMemberRole) {
  return {
    id: `row-${userId}`,
    team_id: "t1",
    user_id: userId,
    event_id: "e1",
    role,
    joined_at: "2026-01-01T00:00:00Z",
    display_name: userId,
    email: null,
  };
}

function team(createdBy: string): TeamWithMembers {
  return {
    id: "t1",
    event_id: "e1",
    name: "The Hack Pack",
    created_by: createdBy,
    project_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    members: [
      member(createdBy, TeamMemberRole.Lead),
      member(createdBy === "lead" ? "mate" : "lead", TeamMemberRole.Member),
    ],
  } as TeamWithMembers;
}

async function renderPanel(myTeam: TeamWithMembers) {
  mockFetchTeams.mockResolvedValue({ myTeam, teams: [myTeam] });
  render(<TeamFormationPanel eventId="e1" />);
  return screen.findByRole("button", { name: "Leave team" });
}

describe("TeamFormationPanel leaving", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("warns the lead before Leave team dissolves the team", async () => {
    fireEvent.click(await renderPanel(team("lead")));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("dissolves the team");
    expect(dialog).toHaveTextContent("All 2 members");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("keeps the team when the lead cancels", async () => {
    fireEvent.click(await renderPanel(team("lead")));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText("The Hack Pack")).toBeInTheDocument();
  });

  it("reports a dissolve, not a leave, once the lead confirms", async () => {
    mockDelete.mockResolvedValue({ dissolved: true });
    fireEvent.click(await renderPanel(team("lead")));
    fireEvent.click(
      await screen.findByRole("button", { name: "Dissolve team" })
    );

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: "Team dissolved" })
    );
    expect(mockDelete).toHaveBeenCalledWith("e1", "t1", "lead");
    expect(mockToast).not.toHaveBeenCalledWith({
      title: "You left the team",
    });
  });

  it("lets a regular member leave without a dissolve warning", async () => {
    mockDelete.mockResolvedValue({ dissolved: false });
    fireEvent.click(await renderPanel(team("someone-else")));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: "You left the team" })
    );
    expect(mockDelete).toHaveBeenCalledWith("e1", "t1", "lead");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
