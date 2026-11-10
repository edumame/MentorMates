import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import type { Project } from "@/lib/types";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import { supabase } from "@/lib/supabase";
import { applyTeammateChanges, type TeammateChanges } from "@/lib/projects/teammates";
import DraftProjectSubmissionFormSinglePage from "./DraftProjectSubmissionFormSinglePage";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectTeamClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-delete", () => ({
  deleteProjectClient: jest.fn(),
}));
jest.mock("@/lib/supabase", () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return { supabase: { from: jest.fn(() => query) } };
});
// react-markdown ships ESM that Jest does not transform.
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: jest.requireActual("react").forwardRef(() => null),
}));
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  default: ({
    onTagsChange,
  }: {
    onTagsChange: (tags: string[], change: { added: string[]; removed: string[] }) => void;
  }) => (
    <button
      onClick={() =>
        onTagsChange(["mate@x.com", "new@x.com"], { added: ["new@x.com"], removed: [] })
      }
    >
      Add teammate
    </button>
  ),
}));

const PROJECT_ID = "project-1";
const leadSession = { user: { id: "u1", email: "lead@x.com" } } as Session;

const hydratedProject = (overrides: Partial<Project> = {}): Project => ({
  id: PROJECT_ID,
  project_name: "Secret project",
  project_description: "Not for public eyes",
  lead_name: "Lead",
  lead_email: "lead@x.com",
  is_private: true,
  teammates: ["mate@x.com"],
  event_id: "event-1",
  track_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  has_submission_field_config: false,
  ...overrides,
});

// What `.from("projects").update().select().single()` actually returns: the DB
// column is `private`, and none of the API's hydrated fields are present.
const rawProjectRow = (teammates: string[]) =>
  ({
    id: PROJECT_ID,
    project_name: "Secret project",
    project_description: "Not for public eyes",
    lead_name: "Lead",
    lead_email: "lead@x.com",
    private: true,
    teammates,
    event_id: "event-1",
    created_at: "2026-01-01T00:00:00Z",
  }) as unknown as Project;

const patchBodies = () =>
  (fetch as jest.Mock).mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([, init]) => JSON.parse(init.body));

const artifactFetchCount = () =>
  (supabase.from as jest.Mock).mock.calls.filter(
    ([table]) => table === "project_artifacts"
  ).length;

const privacySelect = () =>
  within(screen.getByText("Project visibility").parentElement!).getByRole(
    "combobox"
  );

const clickRemoveTeammate = () => {
  const row = screen.getAllByText("mate@x.com")[0].parentElement!.parentElement!;
  fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
};

const clickAddTeammate = () =>
  fireEvent.click(screen.getByRole("button", { name: "Add teammate" }));

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

async function renderForm(project: Project) {
  const onProjectUpdate = jest.fn();
  render(
    <DraftProjectSubmissionFormSinglePage
      projectId={PROJECT_ID}
      session={leadSession}
      project={project}
      canEdit
      onProjectUpdate={onProjectUpdate}
    />
  );
  await settle();
  return { onProjectUpdate };
}

describe("DraftProjectSubmissionFormSinglePage team changes", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ project: hydratedProject(), participants: [] }),
    });
    (updateProjectTeamClient as jest.Mock).mockImplementation(
      // The stored team is ["mate@x.com"]; the client applies the change to it.
      async (_projectId: string, changes: TeammateChanges) => ({
        data: rawProjectRow(applyTeammateChanges(["mate@x.com"], changes)),
        error: null,
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const changes: Array<[string, () => void, string[], TeammateChanges]> = [
    ["removing a teammate", clickRemoveTeammate, [], { remove: ["mate@x.com"] }],
    [
      "adding a teammate",
      clickAddTeammate,
      ["mate@x.com", "new@x.com"],
      { add: ["new@x.com"], remove: [] },
    ],
  ];

  it.each(changes)(
    "keeps a private project private after %s",
    async (_name, changeTeam, expectedTeammates, expectedChange) => {
      const { onProjectUpdate } = await renderForm(hydratedProject());

      changeTeam();
      await settle();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(updateProjectTeamClient).toHaveBeenCalledWith(
        PROJECT_ID,
        expectedChange
      );
      expect(patchBodies()).not.toContainEqual(
        expect.objectContaining({ private: false })
      );
      expect(privacySelect()).toHaveTextContent("Private");
      expect(onProjectUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          is_private: true,
          teammates: expectedTeammates,
        })
      );
    }
  );

  it.each(changes)(
    "keeps a public project public after %s",
    async (_name, changeTeam) => {
      await renderForm(hydratedProject({ is_private: false }));

      changeTeam();
      await settle();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(patchBodies()).not.toContainEqual(
        expect.objectContaining({ private: true })
      );
      expect(privacySelect()).toHaveTextContent("Public");
    }
  );

  it.each(changes)(
    "does not re-run artifact hydration, which would overwrite unsaved links, after %s",
    async (_name, changeTeam) => {
      await renderForm(hydratedProject());
      const fetchesAfterLoad = artifactFetchCount();
      expect(fetchesAfterLoad).toBeGreaterThan(0);

      changeTeam();
      await settle();

      expect(artifactFetchCount()).toBe(fetchesAfterLoad);
    }
  );

  it("shows the new team list and leaves project fields alone", async () => {
    const { onProjectUpdate } = await renderForm(
      hydratedProject({ cover_image_url: "https://example.com/cover.png" })
    );

    clickRemoveTeammate();
    await settle();

    expect(screen.queryByText("mate@x.com")).toBeNull();
    expect(onProjectUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cover_image_url: "https://example.com/cover.png",
        has_submission_field_config: false,
        teammates: [],
      })
    );
  });

  it("keeps the current team when the update returns no row", async () => {
    (updateProjectTeamClient as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "denied" },
    });
    await renderForm(hydratedProject());

    clickRemoveTeammate();
    await settle();

    expect(screen.getAllByText("mate@x.com").length).toBeGreaterThan(0);
    expect(privacySelect()).toHaveTextContent("Private");
  });
});
