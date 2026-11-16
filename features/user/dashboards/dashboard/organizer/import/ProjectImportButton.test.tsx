import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectImport } from "./ProjectImportButton";

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const assignEventProjectTracks = jest.fn();
jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  assignEventProjectTracks: (...args: unknown[]) => assignEventProjectTracks(...args),
}));

// Rows the mocked CSV parser emits, header row first.
let mockCsvRows: string[][] = [];
jest.mock("papaparse", () => ({
  __esModule: true,
  default: {
    parse: (
      _file: File,
      options: { step: (row: { data: string[] }) => void; complete: () => void }
    ) => {
      mockCsvRows.forEach((data) => options.step({ data }));
      options.complete();
    },
  },
}));

const from = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

const HEADERS = [
  "Project Title",
  "Please Provide A Link To Your Git Hub.",
  "Team Member 1 Email",
  "Opt-In Prizes",
];

const EVENT_ID = "event-1";

/**
 * Supabase fake for the import: "Health" already exists, new track names are
 * created, and the project upsert returns one row per CSV project.
 */
function mockDatabase() {
  const projectTrackWrites = jest.fn();
  from.mockImplementation((table: string) => {
    if (table === "event_tracks") {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [{ track_id: "track-health", name: "Health" }], error: null }),
          }),
        }),
        insert: (rows: Array<{ name: string }>) => ({
          select: async () => ({
            data: rows.map((row) => ({ track_id: `track-${row.name.toLowerCase()}`, name: row.name })),
            error: null,
          }),
        }),
      };
    }
    if (table === "projects") {
      return {
        upsert: (rows: Array<Record<string, unknown>>) => ({
          select: async () => ({
            data: rows.map((row, i) => ({
              id: `project-${i + 1}`,
              project_url: row.project_url,
              event_id: row.event_id,
              project_name: row.project_name,
            })),
            error: null,
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }
    if (table === "project_tracks") {
      projectTrackWrites(table);
      throw new Error("project_tracks must be written through the API");
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { projectTrackWrites };
}

async function importCsv(rows: string[][]) {
  mockCsvRows = [HEADERS, ...rows];
  const { container } = render(<ProjectImport eventId={EVENT_ID} />);
  const input = container.querySelector('input[type="file"]')!;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(["csv"], "projects.csv")] } });
  });
  fireEvent.click(screen.getByRole("button", { name: "Import to this event" }));
  await waitFor(() => expect(toast).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProjectImport track assignment", () => {
  it("replaces each imported project's tracks from its CSV row in one API call", async () => {
    const { projectTrackWrites } = mockDatabase();
    assignEventProjectTracks.mockResolvedValue({ success: true, error: null, appliedProjects: 2 });

    await importCsv([
      ["Alpha", "https://github.com/a", "a@x.com", "Health, Climate"],
      ["Beta", "https://github.com/b", "b@x.com", "Climate"],
    ]);

    expect(assignEventProjectTracks).toHaveBeenCalledTimes(1);
    expect(assignEventProjectTracks).toHaveBeenCalledWith(EVENT_ID, "replace", [
      { projectId: "project-1", trackIds: ["track-health", "track-climate"] },
      { projectId: "project-2", trackIds: ["track-climate"] },
    ]);
    expect(projectTrackWrites).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Projects imported successfully" })
    );
  });

  it("leaves the tracks of a project whose row lists none untouched", async () => {
    mockDatabase();
    assignEventProjectTracks.mockResolvedValue({ success: true, error: null, appliedProjects: 1 });

    await importCsv([
      ["Alpha", "https://github.com/a", "a@x.com", "Health"],
      ["Beta", "https://github.com/b", "b@x.com", ""],
    ]);

    expect(assignEventProjectTracks).toHaveBeenCalledWith(EVENT_ID, "replace", [
      { projectId: "project-1", trackIds: ["track-health"] },
    ]);
  });

  it("does not call the API when no row lists tracks", async () => {
    mockDatabase();

    await importCsv([["Alpha", "https://github.com/a", "a@x.com", ""]]);

    expect(assignEventProjectTracks).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Projects imported successfully" })
    );
  });

  it("shows the server's reason when assigning tracks fails", async () => {
    mockDatabase();
    assignEventProjectTracks.mockResolvedValue({
      success: false,
      error: new Error("Forbidden"),
      appliedProjects: 0,
    });

    await importCsv([["Alpha", "https://github.com/a", "a@x.com", "Health"]]);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error creating project-track relationships",
        description: "Forbidden",
        variant: "destructive",
      })
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Projects imported successfully" })
    );
  });

  it("says how far a batched assignment got before it failed", async () => {
    mockDatabase();
    assignEventProjectTracks.mockResolvedValue({
      success: false,
      error: new Error("Failed to assign project tracks"),
      appliedProjects: 1,
    });

    await importCsv([
      ["Alpha", "https://github.com/a", "a@x.com", "Health"],
      ["Beta", "https://github.com/b", "b@x.com", "Health"],
    ]);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Failed to assign project tracks (tracks were set for 1 of 2 projects)",
      })
    );
  });
});
