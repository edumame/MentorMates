import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JoinProjectPage from "./page";

const mockPush = jest.fn();
const mockSetReturnUrl = jest.fn();
const mockGetSession = jest.fn();
const mockProjectSingle = jest.fn();
const mockRoleMaybeSingle = jest.fn();
let mockSearch = "project=project-1&token=t";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({ setReturnUrlFromCurrentLocation: mockSetReturnUrl }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({ eq: () => ({ single: () => mockProjectSingle() }) }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => mockRoleMaybeSingle() }),
          }),
        }),
      };
    },
  },
}));

const hiddenByRls = { data: null, error: { code: "PGRST116" } };

const preview = {
  id: "project-1",
  project_name: "Secret Project",
  project_description: "Hidden by RLS",
  lead_name: "Lead Person",
  event_id: "event-1",
  event: { event_name: "Hack Night", event_date: "2026-11-20" },
};

function mockVerifyResponse(status: number, body: Record<string, unknown>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function mockSignedIn(email: string) {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "user-1", email } } },
  });
}

describe("JoinProjectPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = "project=project-1&token=t";
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockProjectSingle.mockResolvedValue(hiddenByRls);
    mockRoleMaybeSingle.mockResolvedValue({ data: null });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("lets a logged-out invitee preview a private project and sign in", async () => {
    mockVerifyResponse(200, {
      valid: true,
      email: "invitee@example.com",
      project: preview,
    });

    render(<JoinProjectPage />);

    const signIn = await screen.findByRole("button", {
      name: "Sign In to Join Project",
    });
    expect(screen.getByText("Secret Project")).toBeInTheDocument();
    expect(screen.getByText("Part of Hack Night")).toBeInTheDocument();
    expect(screen.getByText("Lead Person")).toBeInTheDocument();
    expect(screen.queryByText("Project Error")).not.toBeInTheDocument();

    fireEvent.click(signIn);
    expect(mockSetReturnUrl).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("sends a signed-in invitee with no event role to event registration", async () => {
    mockSignedIn("invitee@example.com");
    mockVerifyResponse(200, {
      valid: true,
      email: "invitee@example.com",
      project: preview,
    });

    render(<JoinProjectPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Join This Project" })
    );

    const link = await screen.findByRole("link", {
      name: "Register for the event",
    });
    expect(link).toHaveAttribute("href", "/events/event-1/overview");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("joins a standalone private project from the preview", async () => {
    mockSignedIn("invitee@example.com");
    mockVerifyResponse(200, {
      valid: true,
      email: "invitee@example.com",
      project: { ...preview, event_id: null, event: null },
    });

    render(<JoinProjectPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Join This Project" })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/join",
        expect.objectContaining({ method: "PUT" })
      )
    );
    expect(await screen.findByText("Successfully Joined!")).toBeInTheDocument();
  });

  it("keeps the full project when RLS allows the direct read", async () => {
    mockSignedIn("lead@example.com");
    mockProjectSingle.mockResolvedValue({
      data: {
        ...preview,
        lead_email: "lead@example.com",
        teammates: [],
        event: [preview.event],
      },
      error: null,
    });
    mockVerifyResponse(200, {
      valid: true,
      email: "lead@example.com",
      project: preview,
    });

    render(<JoinProjectPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Join This Project" })
    );

    expect(
      await screen.findByText("You are already the project lead")
    ).toBeInTheDocument();
  });

  it("shows the invite error without project details for a rejected token", async () => {
    mockVerifyResponse(401, {
      valid: false,
      error: "Invalid or expired token",
    });

    render(<JoinProjectPage />);

    expect(
      await screen.findByText("Invalid or expired token")
    ).toBeInTheDocument();
    expect(screen.getByText("Project Error")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret Project")).not.toBeInTheDocument();
  });

  it("reports a missing project when a valid token has no preview", async () => {
    mockVerifyResponse(200, {
      valid: true,
      email: "invitee@example.com",
      project: null,
    });

    render(<JoinProjectPage />);

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });

  it("reports a missing project when there is no token and RLS hides the row", async () => {
    mockSearch = "project=project-1";
    mockVerifyResponse(200, {});

    render(<JoinProjectPage />);

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports a missing project id even when a token is present", async () => {
    mockSearch = "token=t";
    mockVerifyResponse(200, {});

    render(<JoinProjectPage />);

    expect(
      await screen.findByText("No project ID provided")
    ).toBeInTheDocument();
  });
});
