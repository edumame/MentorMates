import { fireEvent, render, screen } from "@testing-library/react";
import ProjectPage from "./page";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { email: "lead@example.com" } } },
      }),
    },
  },
}));

jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/features/projects/hooks/use-project-like", () => ({
  useProjectLike: () => ({
    liked: false,
    count: 0,
    isLoading: false,
    error: null,
    toggleLike: jest.fn(),
  }),
}));
jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectTimeline", () => ({
  __esModule: true,
  default: () => null,
}));

describe("ProjectPage draft banner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        project: {
          id: "project-1",
          project_name: "Draft project",
          lead_name: "Lead",
          lead_email: "lead@example.com",
          project_description: "Draft",
          teammates: [],
          submitted: false,
          event_id: "event-1",
        },
      }),
    })) as unknown as typeof fetch;
  });

  it("sends Submit to event through the edit form instead of posting directly", async () => {
    render(<ProjectPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Submit to event" }),
    );

    expect(push).toHaveBeenCalledWith("/projects/project-1/edit");
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/projects/submit",
      expect.anything(),
    );
  });
});
