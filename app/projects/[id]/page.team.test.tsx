import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectPage from "./page";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";

const LEAD = "lead@x.com";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/projects/project-1",
}));

jest.mock("@/lib/supabase", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    query[method] = () => query;
  }
  query.single = async () => ({ data: null, error: null });
  query.then = (resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 });

  return {
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: { user: { email: "lead@x.com" } } },
        }),
      },
      from: () => query,
    },
  };
});

jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectClient: jest.fn(),
  updateProjectTeamClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-materials", () => ({
  saveProjectMaterials: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-delete", () => ({
  deleteProjectClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  fetchEventTracks: async () => ({ data: [], error: null }),
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
jest.mock("@/features/projects/components/feedback/FeedbackDisplay", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/features/projects/components/feedback/GiveFeedbackDialog", () => ({
  GiveFeedbackDialog: () => null,
}));

jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));

const updateTeam = updateProjectTeamClient as jest.MockedFunction<
  typeof updateProjectTeamClient
>;

type TestProject = { event_id: string | null; teammates: string[] };

const buildProject = ({ event_id, teammates }: TestProject) => ({
  id: "project-1",
  project_name: "Test project",
  lead_name: "Lead",
  lead_email: LEAD,
  event_id,
  teammates,
});

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

function mockApi(
  project: TestProject,
  participantsResponse: ReturnType<typeof jsonResponse> = jsonResponse({
    users: [],
  })
) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/projects?projectId=")) {
      return jsonResponse({ project: buildProject(project) });
    }
    if (url.includes("/users?roles=participant")) {
      return participantsResponse;
    }
    if (url === "/api/projects/invite-teammate") {
      return jsonResponse({ success: true });
    }
    return jsonResponse({});
  }) as unknown as typeof fetch;
}

const participant = (email: string, name: string) => ({
  user_id: email,
  display_name: name,
  email,
});

async function openTeamTab() {
  render(<ProjectPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name: /^Team/ }));
  await screen.findByText("Add team member");
  return user;
}

const searchInput = () =>
  screen.getByPlaceholderText("Type to search teammates or enter email...");

async function sendInvite(
  user: ReturnType<typeof userEvent.setup>,
  email: string
) {
  await user.type(searchInput(), email);
  await user.click(
    await screen.findByRole("button", { name: /Send project invitation/ })
  );
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects/invite-teammate",
      expect.anything()
    )
  );
  // The chip appears once the invite has finished and tags have been reported.
  await waitFor(() => expect(searchInput()).toHaveValue(""));
}

function removeChip(label: string) {
  const tagList = document.getElementById("tagList") as HTMLElement;
  const chip = Array.from(tagList.children).find((element) =>
    element.textContent?.includes(label)
  ) as HTMLElement;
  fireEvent.click(within(chip).getByRole("button", { name: "Remove" }));
}

describe("project team tab", () => {
  beforeEach(() => {
    updateTeam.mockReset();
    updateTeam.mockImplementation(async (_projectId, teammates) => ({
      data: buildProject({ event_id: null, teammates }) as never,
      error: null,
    }));
  });

  it("keeps every teammate when inviting from a standalone project", async () => {
    mockApi({ event_id: null, teammates: ["a@x.com", "b@x.com"] });
    const user = await openTeamTab();

    await sendInvite(user, "c@x.com");

    expect(updateTeam).not.toHaveBeenCalled();
  });

  it("keeps every teammate when the participants fetch fails", async () => {
    mockApi(
      { event_id: "event-1", teammates: ["a@x.com", "b@x.com"] },
      jsonResponse({ error: "boom" }, false)
    );
    const user = await openTeamTab();

    await sendInvite(user, "c@x.com");

    expect(updateTeam).not.toHaveBeenCalled();
  });

  it("keeps a non-participant teammate when adding a participant", async () => {
    mockApi(
      { event_id: "event-1", teammates: ["a@x.com", "mentor@x.com"] },
      jsonResponse({
        users: [
          participant("a@x.com", "Ann"),
          participant("p@x.com", "Pat"),
        ],
      })
    );
    const user = await openTeamTab();

    await user.type(searchInput(), "pat");
    await user.click(await screen.findByText("Pat (p@x.com)"));

    await waitFor(() => expect(updateTeam).toHaveBeenCalledTimes(1));
    expect(updateTeam).toHaveBeenCalledWith("project-1", [
      "a@x.com",
      "mentor@x.com",
      "p@x.com",
    ]);
  });

  it("does not add a chip that is not an event participant", async () => {
    mockApi({ event_id: "event-1", teammates: ["a@x.com"] });
    const user = await openTeamTab();

    await sendInvite(user, "new@x.com");

    expect(updateTeam).not.toHaveBeenCalled();
  });

  it("removes only the teammate whose chip was removed", async () => {
    mockApi({ event_id: null, teammates: ["a@x.com", "b@x.com"] });
    await openTeamTab();

    removeChip("a@x.com");

    await waitFor(() => expect(updateTeam).toHaveBeenCalledTimes(1));
    expect(updateTeam).toHaveBeenCalledWith("project-1", ["b@x.com"]);
  });

  it("removes a teammate whose stored email has different casing", async () => {
    mockApi(
      { event_id: "event-1", teammates: ["Ann@x.com", "b@x.com"] },
      jsonResponse({ users: [participant("ann@x.com", "Ann")] })
    );
    await openTeamTab();

    removeChip("Ann (ann@x.com)");

    await waitFor(() => expect(updateTeam).toHaveBeenCalledTimes(1));
    expect(updateTeam).toHaveBeenCalledWith("project-1", ["b@x.com"]);
  });

  it("does not write when removing the chip of a pending invite", async () => {
    mockApi({ event_id: null, teammates: ["a@x.com"] });
    const user = await openTeamTab();
    await sendInvite(user, "c@x.com");

    removeChip("c@x.com");

    expect(updateTeam).not.toHaveBeenCalled();
  });

  it("removes nobody else on the next invite after a chip removal", async () => {
    mockApi({ event_id: null, teammates: ["a@x.com", "b@x.com"] });
    const user = await openTeamTab();
    removeChip("a@x.com");
    await waitFor(() => expect(updateTeam).toHaveBeenCalledTimes(1));

    await sendInvite(user, "c@x.com");

    expect(updateTeam).toHaveBeenCalledTimes(1);
  });
});
