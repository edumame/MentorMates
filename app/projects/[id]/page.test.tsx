import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/hooks/use-toast";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import ProjectPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/lib/hooks/use-toast", () => ({
  toast: jest.fn(),
  useToast: () => ({ toast: jest.fn(), toasts: [] }),
}));

jest.mock(
  "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions",
  () => ({
    useQRCodeActions: () => ({
      handleCopyQR: jest.fn(),
      handleDownloadQR: jest.fn(),
    }),
  })
);

jest.mock("@/features/projects/hooks/use-project-like", () => ({
  useProjectLike: () => ({
    liked: false,
    count: 0,
    isLoading: false,
    toggleLike: jest.fn(),
    error: null,
  }),
}));

jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectClient: jest.fn(),
  updateProjectTeamClient: jest.fn(),
}));

jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  fetchEventTracks: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock("@/features/projects/client-actions/client-delete", () => ({
  deleteProjectClient: jest.fn(),
}));

jest.mock("@/features/projects/client-actions/client-materials", () => ({
  saveProjectMaterials: jest.fn(),
}));

jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));

jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));

jest.mock("@/features/projects/components/feedback/FeedbackDisplay", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/features/projects/components/feedback/GiveFeedbackDialog", () => ({
  GiveFeedbackDialog: () => null,
}));

jest.mock("@/features/projects/components/tracks/TrackSelector", () => ({
  TrackSelector: () => null,
}));

jest.mock("@/features/projects/components/displays/project-dashboard/ProjectQRCodeSection", () => ({
  ProjectQRCodeSection: () => null,
}));

jest.mock("@/features/projects/components/displays/ProjectTimeline", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: () => null,
}));

jest.mock("@/features/projects/components/displays/ProjectSubmissionDetails", () => ({
  ProjectSubmissionDetails: () => null,
}));

jest.mock("@/features/projects/components/displays/ProjectShareSection", () => ({
  ProjectShareSection: () => null,
}));

jest.mock("@/components/db/fileUpload", () => ({ FileUpload: () => null }));
jest.mock("@/components/db/imageUpload", () => ({ ImageUpload: () => null }));

jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  // Renders once participants load, since the page only adds known participants.
  default: ({
    allTags,
    onTagsChange,
  }: {
    allTags: string[];
    onTagsChange: (tags: string[]) => void;
  }) =>
    allTags.length > 0 ? (
      <button onClick={() => onTagsChange(["New Nia (new@example.com)"])}>
        Add new teammate
      </button>
    ) : null,
}));

const project = {
  id: "project-1",
  project_name: "Rocket",
  lead_name: "Lea Lead",
  lead_email: "lead@example.com",
  teammates: ["Mate@Example.com"],
  event_id: "event-1",
  submitted: true,
};

const profile = (display_name: string, affiliation: string) => ({
  display_name,
  avatar_url: null,
  affiliation,
});

const teamProfiles = {
  "lead@example.com": profile("Profile Lead", "Lead College"),
  "mate@example.com": profile("Mia Mate", "State U"),
};

function apiResponse(overrides: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({ project: { ...project, ...overrides } }),
  };
}

/** Serves /api/projects reads in order; returns a count of those reads. */
function mockApi(projectReads: Array<ReturnType<typeof apiResponse> | Error>) {
  let reads = 0;
  global.fetch = jest.fn(async (url: string) => {
    if (url.startsWith("/api/events/")) {
      return {
        ok: true,
        json: async () => ({
          users: [{ id: "new", email: "new@example.com", display_name: null }],
        }),
      };
    }
    const read = projectReads[Math.min(reads++, projectReads.length - 1)];
    if (read instanceof Error) throw read;
    return read;
  }) as unknown as typeof fetch;
  return () => reads;
}

async function addTeammate() {
  const user = userEvent.setup();
  render(<ProjectPage />);
  await user.click(await screen.findByRole("tab", { name: /team/i }));
  await user.click(await screen.findByText("Add new teammate"));
}

function mockViewer(email: string) {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: "viewer", email } } },
  });
}

describe("ProjectPage team members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A viewer RLS hides profiles from: user_profiles returns no rows.
    (supabase.from as jest.Mock).mockImplementation(() => {
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => ({ data: [], error: null }),
        order: async () => ({ data: [], error: null }),
        single: async () => ({ data: null, error: new Error("hidden") }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return query;
    });
    mockViewer("judge@example.com");
  });

  it("shows team names and affiliation from the API to a hidden-profile viewer", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(apiResponse({ team_profiles: teamProfiles }));

    render(<ProjectPage />);

    expect((await screen.findAllByText("Mia Mate")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile Lead").length).toBeGreaterThan(0);
    expect(screen.getAllByText("State U").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lead College").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mate@Example.com")).not.toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalledWith("user_profiles");
  });

  it("falls back to lead_name and the email without API profiles", async () => {
    global.fetch = jest.fn().mockResolvedValue(apiResponse({}));

    render(<ProjectPage />);

    expect((await screen.findAllByText("Lea Lead")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mate@Example.com").length).toBeGreaterThan(0);
  });

  it("loads a new teammate's profile and keeps the others after adding them", async () => {
    mockViewer("lead@example.com");
    const teammates = ["Mate@Example.com", "new@example.com"];
    const projectReads = mockApi([
      apiResponse({ team_profiles: teamProfiles }),
      apiResponse({
        teammates,
        team_profiles: {
          ...teamProfiles,
          "new@example.com": profile("New Nia", "Tech U"),
        },
      }),
    ]);
    // The update returns a raw projects row, without team_profiles.
    (updateProjectTeamClient as jest.Mock).mockResolvedValue({
      data: { ...project, teammates },
      error: null,
    });

    await addTeammate();

    expect((await screen.findAllByText("New Nia")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mia Mate").length).toBeGreaterThan(0);
    expect(projectReads()).toBe(2);
  });

  it("keeps existing profiles when the refresh after adding fails", async () => {
    mockViewer("lead@example.com");
    mockApi([
      apiResponse({ team_profiles: teamProfiles }),
      new Error("offline"),
    ]);
    (updateProjectTeamClient as jest.Mock).mockResolvedValue({
      data: { ...project, teammates: ["Mate@Example.com", "new@example.com"] },
      error: null,
    });

    await addTeammate();

    expect(
      (await screen.findAllByText("new@example.com")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Mia Mate").length).toBeGreaterThan(0);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Team member added" })
    );
  });
});
