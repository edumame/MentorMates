import { render, screen } from "@testing-library/react";
import { supabase } from "@/lib/supabase";
import PublicProjectPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
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
  }),
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

jest.mock("@/components/project-scoring/default-scoring", () => ({
  DefaultScoring: () => null,
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

const project = {
  id: "project-1",
  project_name: "Rocket",
  lead_name: "Lea Lead",
  lead_email: "lead@example.com",
  teammates: ["Mate@Example.com"],
  event_id: "event-1",
  submitted: true,
};

const teamProfiles = {
  "lead@example.com": {
    display_name: "Profile Lead",
    avatar_url: null,
    affiliation: "Lead College",
  },
  "mate@example.com": {
    display_name: "Mia Mate",
    avatar_url: null,
    affiliation: "State U",
  },
};

function mockProject(overrides: Record<string, unknown>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ project: { ...project, ...overrides } }),
  });
}

describe("PublicProjectPage team members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A viewer RLS hides profiles from: user_profiles returns no rows.
    (supabase.from as jest.Mock).mockImplementation(() => {
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => ({ data: [], error: null }),
        single: async () => ({ data: null, error: new Error("hidden") }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return query;
    });
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
  });

  it("shows team names and affiliation from the API to a hidden-profile viewer", async () => {
    mockProject({ team_profiles: teamProfiles });

    render(<PublicProjectPage />);

    expect((await screen.findAllByText("Mia Mate")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile Lead").length).toBeGreaterThan(0);
    expect(screen.getAllByText("State U").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lead College").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mate@Example.com")).not.toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalledWith("user_profiles");
  });

  it("falls back to lead_name and the email without API profiles", async () => {
    mockProject({});

    render(<PublicProjectPage />);

    expect((await screen.findAllByText("Lea Lead")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mate@Example.com").length).toBeGreaterThan(0);
  });
});
