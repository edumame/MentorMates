import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EventDetails } from "@/lib/types";
import { TeamMemberRole, TeamWithMembers } from "@/lib/types/team";
import {
  deleteTeamOrMember,
  fetchTeams,
} from "@/features/teams/api/teamsClient";
import { OrganizerTeamsTab } from "./index";

const mockToast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/lib/supabase", () => ({ supabase: {} }));

jest.mock("@/features/teams/api/teamsClient", () => ({
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

const team = {
  id: "t1",
  event_id: "e1",
  name: "The Hack Pack",
  created_by: "lead",
  project_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  members: [
    member("lead", TeamMemberRole.Lead),
    member("mate", TeamMemberRole.Member),
  ],
} as TeamWithMembers;

function renderTab() {
  mockFetchTeams.mockResolvedValue({ myTeam: null, teams: [team] });
  render(
    <OrganizerTeamsTab
      eventId="e1"
      event={{ team_formation_enabled: true } as EventDetails}
      setEvent={jest.fn()}
    />
  );
}

describe("OrganizerTeamsTab member removal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("warns before removing the lead dissolves the team", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Remove lead" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("dissolves the team");
    expect(dialog).toHaveTextContent("All 2 members");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("reports a dissolve once the organizer confirms", async () => {
    mockDelete.mockResolvedValue({ dissolved: true });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Remove lead" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Dissolve team" })
    );

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: "Team dissolved" })
    );
    expect(mockDelete).toHaveBeenCalledWith("e1", "t1", "lead");
    expect(mockToast).not.toHaveBeenCalledWith({ title: "Member removed" });
  });

  it("keeps the team when the organizer cancels", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Remove lead" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("removes a regular member without a dissolve warning", async () => {
    mockDelete.mockResolvedValue({ dissolved: false });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Remove mate" }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: "Member removed" })
    );
    expect(mockDelete).toHaveBeenCalledWith("e1", "t1", "mate");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
