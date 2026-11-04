import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JoinProjectPage from "./page";

const push = jest.fn();
const USER_EMAIL = "invitee@example.com";

let eventRole: { role: string } | null = { role: "participant" };
let project: Record<string, unknown>;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () =>
    new URLSearchParams("project=project-1&token=invite-token"),
}));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({ setReturnUrlFromCurrentLocation: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: "user-1", email: "invitee@example.com" } },
        },
      }),
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: project, error: null }),
        maybeSingle: async () => ({
          data: table === "user_event_roles" ? eventRole : null,
          error: null,
        }),
      };
      return query;
    },
  },
}));

const fetchMock = jest.fn();

const joinCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/projects/join");

const renderAndClickJoin = async () => {
  render(<JoinProjectPage />);
  await screen.findByText(`Valid invitation for`, { exact: false });
  await screen.findByText(USER_EMAIL, { selector: "p strong" });
  fireEvent.click(screen.getByRole("button", { name: /Join This Project/ }));
};

describe("JoinProjectPage", () => {
  beforeEach(() => {
    push.mockClear();
    eventRole = { role: "participant" };
    project = {
      id: "project-1",
      project_name: "Relief Map",
      project_description: null,
      lead_name: "Lead",
      lead_email: "lead@example.com",
      teammates: [],
      event_id: "event-1",
      event: [],
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url === "/api/projects/verify-invite-token"
          ? { valid: true, email: USER_EMAIL }
          : {},
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("joins a project the invitee is not yet on", async () => {
    await renderAndClickJoin();

    expect(await screen.findByText("Successfully Joined!")).toBeInTheDocument();
    expect(joinCalls()).toHaveLength(1);
  });

  it.each([[USER_EMAIL], ["Invitee@Example.com"]])(
    "treats an invitee already listed as %s as joined without adding them again",
    async (listedEmail) => {
      project.teammates = [listedEmail];

      await renderAndClickJoin();

      expect(
        await screen.findByText("Successfully Joined!")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("You are already a member of this project")
      ).not.toBeInTheDocument();
      expect(joinCalls()).toHaveLength(0);
    }
  );

  it("redirects an existing member to the project", async () => {
    project.teammates = [USER_EMAIL];

    await renderAndClickJoin();
    await screen.findByText("Successfully Joined!");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/project-1"), {
      timeout: 3000,
    });
  });

  it("still requires event registration for an existing member", async () => {
    project.teammates = [USER_EMAIL];
    eventRole = null;

    await renderAndClickJoin();

    expect(
      await screen.findByText(/You must be registered for the event/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Successfully Joined!")).not.toBeInTheDocument();
    expect(joinCalls()).toHaveLength(0);
  });
});
