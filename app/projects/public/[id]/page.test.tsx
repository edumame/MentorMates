import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import PublicProjectPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => {
  const eventQuery = {
    select: () => eventQuery,
    eq: () => eventQuery,
    in: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => eventQuery,
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    },
  };
});

jest.mock("@/features/projects/hooks/use-project-like", () => ({
  useProjectLike: () => ({
    liked: false,
    count: 0,
    isLoading: false,
    toggleLike: jest.fn(),
  }),
}));

jest.mock(
  "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions",
  () => ({
    useQRCodeActions: () => ({
      handleCopyQR: jest.fn(),
      handleDownloadQR: jest.fn(),
    }),
  }),
);

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

jest.mock(
  "@/features/projects/components/displays/ProjectFieldEntriesSection",
  () => ({ ProjectFieldEntriesSection: () => null }),
);

// react-markdown ships ESM that Jest does not transform.
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));

const PUBLIC_URL = "/api/projects?public=true&projectId=project-1";
const AUTHENTICATED_URL = "/api/projects?projectId=project-1";

const project = {
  id: "project-1",
  project_name: "Shared Link Project",
  project_description: "A project opened from a QR code",
  lead_name: "Lead Person",
  lead_email: "lead@example.com",
  teammates: [],
  event_id: "event-1",
  created_at: "2026-01-01T00:00:00.000Z",
  submitted: true,
  artifacts: [],
  tracks: [],
};

function mockApi(responses: Record<string, { status: number; body: unknown }>) {
  const fetchMock = jest.fn(async (url: string) => {
    const response = responses[url] ?? { status: 404, body: {} };
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("PublicProjectPage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows a public project to a logged-out visitor", async () => {
    mockApi({
      [PUBLIC_URL]: { status: 200, body: { project } },
      [AUTHENTICATED_URL]: { status: 401, body: { error: "Unauthorized" } },
    });

    render(<PublicProjectPage />);

    expect(
      await screen.findByRole("heading", { name: "Shared Link Project" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  });

  it("falls back to the authenticated API for a private-event judge", async () => {
    const fetchMock = mockApi({
      [PUBLIC_URL]: { status: 404, body: { error: "Project not found" } },
      [AUTHENTICATED_URL]: { status: 200, body: { project } },
    });

    render(<PublicProjectPage />);

    expect(
      await screen.findByRole("heading", { name: "Shared Link Project" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(PUBLIC_URL);
    expect(fetchMock).toHaveBeenCalledWith(AUTHENTICATED_URL);
  });

  it("shows not found when neither API returns the project", async () => {
    mockApi({
      [PUBLIC_URL]: { status: 404, body: { error: "Project not found" } },
      [AUTHENTICATED_URL]: { status: 401, body: { error: "Unauthorized" } },
    });

    render(<PublicProjectPage />);

    await waitFor(() =>
      expect(screen.getByText("Project not found")).toBeInTheDocument(),
    );
  });
});
