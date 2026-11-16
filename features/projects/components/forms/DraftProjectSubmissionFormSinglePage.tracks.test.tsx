import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import type { Project } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { deleteProjectClient } from "@/features/projects/client-actions/client-delete";
import { updateProjectTracks } from "@/features/projects/client-actions/client-track-update";
import DraftProjectSubmissionFormSinglePage from "./DraftProjectSubmissionFormSinglePage";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectTeamClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-delete", () => ({
  deleteProjectClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  updateProjectTracks: jest.fn(),
}));

// Saved project_tracks rows, read back by fetchProjectTracks.
let mockSavedTrackIds: string[] = [];
jest.mock("@/lib/supabase", () => {
  const rowsFor = (table: string) => {
    if (table === "event_tracks") {
      return [
        { track_id: "track-health", name: "Health", description: null },
        { track_id: "track-climate", name: "Climate", description: null },
      ];
    }
    if (table === "project_tracks") {
      return mockSavedTrackIds.map((track_id) => ({ track_id }));
    }
    return [];
  };
  return {
    supabase: {
      from: jest.fn((table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: rowsFor(table), error: null }).then(resolve),
        };
        return query;
      }),
    },
  };
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
  default: () => null,
}));

const PROJECT_ID = "project-1";
const leadSession = { user: { id: "u1", email: "lead@x.com" } } as Session;

const project: Project = {
  id: PROJECT_ID,
  project_name: "Draft project",
  project_description: "Description",
  lead_name: "Lead",
  lead_email: "lead@x.com",
  is_private: false,
  teammates: [],
  event_id: "event-1",
  track_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  has_submission_field_config: false,
} as Project;

const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

const trackCheckbox = (name: string) =>
  within(screen.getByText(name).closest("label")!).getByRole("checkbox");

async function renderForm() {
  render(
    <DraftProjectSubmissionFormSinglePage
      projectId={PROJECT_ID}
      session={leadSession}
      project={project}
      canEdit
      onProjectUpdate={jest.fn()}
    />
  );
  await settle();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSavedTrackIds = [];
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ participants: [] }),
  });
  (updateProjectTracks as jest.Mock).mockResolvedValue({ success: true, error: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("DraftProjectSubmissionFormSinglePage tracks", () => {
  it("saves a ticked track through the API helper", async () => {
    await renderForm();

    fireEvent.click(trackCheckbox("Health"));
    await settle();

    expect(updateProjectTracks).toHaveBeenCalledWith(PROJECT_ID, ["track-health"]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Tracks Updated" }));
  });

  it("never writes project_tracks through the browser Supabase client", async () => {
    await renderForm();

    fireEvent.click(trackCheckbox("Health"));
    await settle();

    // project_tracks is only read (fetchProjectTracks); delete/insert are gone.
    const trackQueries = (supabase.from as jest.Mock).mock.results
      .filter((_, i) => (supabase.from as jest.Mock).mock.calls[i][0] === "project_tracks")
      .map((result) => result.value);
    for (const queryBuilder of trackQueries) {
      expect(queryBuilder).not.toHaveProperty("delete");
      expect(queryBuilder).not.toHaveProperty("insert");
    }
  });

  it("shows the server's reason and reloads the saved tracks when a save fails", async () => {
    (updateProjectTracks as jest.Mock).mockResolvedValue({
      success: false,
      error: new Error("The submission deadline has passed"),
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await renderForm();
    const projectTrackReadsBefore = (supabase.from as jest.Mock).mock.calls.filter(
      ([table]) => table === "project_tracks"
    ).length;

    fireEvent.click(trackCheckbox("Health"));
    await settle();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        description: "The submission deadline has passed",
        variant: "destructive",
      })
    );
    const projectTrackReadsAfter = (supabase.from as jest.Mock).mock.calls.filter(
      ([table]) => table === "project_tracks"
    ).length;
    expect(projectTrackReadsAfter).toBe(projectTrackReadsBefore + 1);
    expect(trackCheckbox("Health")).not.toBeChecked();
    consoleSpy.mockRestore();
  });

  it("runs overlapping saves one at a time and ends on the latest selection", async () => {
    const first = deferred<{ success: boolean; error: null }>();
    (updateProjectTracks as jest.Mock)
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({ success: true, error: null });
    await renderForm();

    fireEvent.click(trackCheckbox("Health"));
    await settle();
    fireEvent.click(trackCheckbox("Climate"));
    await settle();

    // The second save waits for the first instead of racing it.
    expect(updateProjectTracks).toHaveBeenCalledTimes(1);

    first.resolve({ success: true, error: null });
    await settle();

    expect(updateProjectTracks).toHaveBeenCalledTimes(2);
    expect((updateProjectTracks as jest.Mock).mock.calls[1]).toEqual([
      PROJECT_ID,
      ["track-health", "track-climate"],
    ]);
    // Only the save that matches the final selection reports.
    expect(
      (toast as jest.Mock).mock.calls.filter(([arg]) => arg.title === "Tracks Updated")
    ).toHaveLength(1);
  });
});

describe("DraftProjectSubmissionFormSinglePage delete", () => {
  async function confirmDelete() {
    await renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    await settle();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete/ }));
    await settle();
  }

  it("goes back to the projects list after a successful delete", async () => {
    (deleteProjectClient as jest.Mock).mockResolvedValue({ success: true, error: null });

    await confirmDelete();

    expect(deleteProjectClient).toHaveBeenCalledWith(PROJECT_ID);
    expect(mockPush).toHaveBeenCalledWith("/projects");
  });

  it("shows the server's reason and stays on the page when the delete fails", async () => {
    (deleteProjectClient as jest.Mock).mockResolvedValue({
      success: false,
      error: new Error("Unauthorized to delete this project"),
    });

    await confirmDelete();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        description: "Unauthorized to delete this project",
        variant: "destructive",
      })
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});
