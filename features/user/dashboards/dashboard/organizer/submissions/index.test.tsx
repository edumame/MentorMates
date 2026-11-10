import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SubmissionsTab } from "./index";

const toast = jest.fn();
const fetchEventTracks = jest.fn();
const updateProjectTracks = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  fetchEventTracks: (...args: unknown[]) => fetchEventTracks(...args),
  updateProjectTracks: (...args: unknown[]) => updateProjectTracks(...args),
}));

jest.mock("./SubmissionFieldsSettings", () => ({
  SubmissionFieldsSettings: () => <div>Submission fields settings</div>,
}));

jest.mock("./export", () => ({
  buildSubmissionExportRows: jest.fn(() => []),
  buildCustomFieldColumns: jest.requireActual("./export").buildCustomFieldColumns,
  formatSubmissionValue: jest.requireActual("./export").formatSubmissionValue,
}));

const profilesIn = jest.fn();
const csvRows: unknown[] = [];
jest.mock("@/lib/utils/csv", () => ({
  toSpreadsheetSafeCsv: (rows: unknown) => {
    csvRows.push(rows);
    return "csv";
  },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: () => ({ in: (...args: unknown[]) => profilesIn(...args) }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(() => ({
        unsubscribe: jest.fn(),
      })),
    })),
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href?.toString()} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    "aria-label": ariaLabel,
    disabled,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    "aria-label"?: string;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: {
    children: React.ReactNode;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
      {children}
    </label>
  ),
}));

describe("SubmissionsTab", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();

    fetchEventTracks.mockResolvedValue({
      data: [
        {
          track_id: "track-1",
          event_id: "event-1",
          name: "AI Track",
          description: "AI",
          scoring_criteria: { name: "AI Track", criteria: [] },
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-01T00:00:00.000Z",
        },
        {
          track_id: "track-2",
          event_id: "event-1",
          name: "Sustainability Track",
          description: "Climate",
          scoring_criteria: { name: "Sustainability Track", criteria: [] },
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    updateProjectTracks.mockResolvedValue({
      success: true,
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: "project-1",
            project_name: "Project One",
            lead_name: "Alice",
            lead_email: "alice@example.com",
            project_description: "Desc",
            teammates: [],
            project_url: null,
            additional_materials_url: null,
            cover_image_url: null,
            event_id: "event-1",
            created_at: "2026-04-01T00:00:00.000Z",
            submitted: true,
            project_tracks: [
              {
                event_tracks: {
                  track_id: "track-1",
                  name: "AI Track",
                },
              },
            ],
            feedback: [],
            submission_fields: [
              {
                key: "demo_needs",
                label: "What does your project need?",
              },
              {
                key: "tags",
                label: "Tags",
              },
            ],
            submission_values: {
              demo_needs: "More compute",
              tags: ["AI", "Accessibility"],
            },
          },
        ],
      }),
    }) as jest.Mock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("saves added and removed track assignments from the submissions table", async () => {
    render(<SubmissionsTab eventId="event-1" />);

    await waitFor(() =>
      expect(screen.getByText("Project One")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /manage tracks/i }));

    const aiCheckbox = screen.getByRole("checkbox", { name: "Assign AI Track" });
    const sustainabilityCheckbox = screen.getByRole("checkbox", {
      name: "Assign Sustainability Track",
    });

    expect(aiCheckbox).toBeChecked();
    expect(sustainabilityCheckbox).not.toBeChecked();

    fireEvent.click(aiCheckbox);
    fireEvent.click(sustainabilityCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Save Tracks" }));

    await waitFor(() => {
      expect(updateProjectTracks).toHaveBeenCalledWith("project-1", ["track-2"]);
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Project tracks updated",
      description: 'Saved track assignments for "Project One".',
    });

    await waitFor(() => {
      expect(screen.getByText("Sustainability Track")).toBeInTheDocument();
    });

    expect(screen.queryByText("AI Track")).not.toBeInTheDocument();
  });

  it("lets organizers add project submission question columns to the table", async () => {
    render(<SubmissionsTab eventId="event-1" />);

    await waitFor(() =>
      expect(screen.getByText("Project One")).toBeInTheDocument()
    );

    expect(screen.queryByText("More compute")).not.toBeInTheDocument();
    expect(screen.queryByText("AI | Accessibility")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "What does your project need?",
      })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Tags" }));

    expect(screen.getByText("More compute")).toBeInTheDocument();
    expect(screen.getByText("AI | Accessibility")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "What does your project need?",
      })
    );

    expect(screen.queryByText("More compute")).not.toBeInTheDocument();
    expect(screen.getByText("AI | Accessibility")).toBeInTheDocument();
  });

  describe("when submissions fail to load", () => {
    let consoleError: jest.SpyInstance;

    const expectLoadFailureShown = async () => {
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load submissions"
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Export Submissions" })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Export Feedback" })
      ).toBeDisabled();
    };

    beforeEach(() => {
      consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it("shows an error and blocks exports on a 500 from the projects API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Failed to load submission answers" }),
      });

      render(<SubmissionsTab eventId="event-1" />);

      await expectLoadFailureShown();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects?eventId=event-1"
      );
    });

    it("shows an error when the 500 response has no JSON body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      });

      render(<SubmissionsTab eventId="event-1" />);

      await expectLoadFailureShown();
    });

    it("shows an error when the request itself fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError("Failed to fetch")
      );

      render(<SubmissionsTab eventId="event-1" />);

      await expectLoadFailureShown();
    });

    it("does not show projects when the tracks read fails", async () => {
      fetchEventTracks.mockResolvedValue({
        data: null,
        error: new Error("tracks unavailable"),
      });

      render(<SubmissionsTab eventId="event-1" />);

      await expectLoadFailureShown();
      expect(screen.queryByText("Project One")).not.toBeInTheDocument();
    });

    it("clears the error once a later event loads", async () => {
      const successfulFetch = (global.fetch as jest.Mock).getMockImplementation();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Failed to load submission answers" }),
      });

      const { rerender } = render(<SubmissionsTab eventId="event-1" />);
      await expectLoadFailureShown();

      (global.fetch as jest.Mock).mockImplementation(successfulFetch);
      rerender(<SubmissionsTab eventId="event-2" />);

      expect(await screen.findByText("Project One")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Export Submissions" })
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Export Feedback" })
      ).toBeEnabled();
    });
  });

  it("keeps the table and exports for an event with no submissions", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ projects: [] }),
    });

    render(<SubmissionsTab eventId="event-1" />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export Submissions" })
      ).toBeEnabled()
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("deleting projects", () => {
    const baseProject = {
      lead_name: "Alice",
      lead_email: "alice@example.com",
      project_description: "Desc",
      teammates: [],
      project_url: null,
      additional_materials_url: null,
      cover_image_url: null,
      event_id: "event-1",
      created_at: "2026-04-01T00:00:00.000Z",
      submitted: true,
      project_tracks: [],
      feedback: [],
    };
    const projects = [
      { ...baseProject, id: "project-1", project_name: "Project One" },
      { ...baseProject, id: "project-2", project_name: "Project Two" },
    ];

    // The mocked realtime channel never fires, which matches a filtered DELETE
    // event that is not delivered, so rows can only go through local state.
    const mockFetch = (failingDeleteIds: string[] = []) => {
      global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          const failed = failingDeleteIds.some((id) => url.endsWith(`/${id}`));
          return failed
            ? { ok: false, json: async () => ({ error: "Delete failed" }) }
            : { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: true, json: async () => ({ projects }) };
      }) as unknown as typeof fetch;
    };

    const renderLoaded = async () => {
      render(<SubmissionsTab eventId="event-1" />);
      await screen.findByText("Project One");
      await screen.findByText("Project Two");
    };

    const confirmSingleDelete = (projectName: string) => {
      const row = screen.getByText(projectName).closest("tr") as HTMLElement;
      fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    };

    const toggle = (name: string) =>
      fireEvent.click(screen.getByRole("checkbox", { name }));

    it("removes a deleted project from the table without a realtime event", async () => {
      mockFetch();
      await renderLoaded();

      confirmSingleDelete("Project One");

      await waitFor(() =>
        expect(screen.queryByText("Project One")).not.toBeInTheDocument()
      );
      expect(screen.getByText("Project Two")).toBeInTheDocument();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Project deleted" })
      );
    });

    it("keeps the row when a single delete fails", async () => {
      mockFetch(["project-1"]);
      await renderLoaded();

      confirmSingleDelete("Project One");

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            description: "Delete failed",
          })
        )
      );
      expect(screen.getByText("Project One")).toBeInTheDocument();
    });

    it("drops a singly deleted project from the selection", async () => {
      mockFetch();
      await renderLoaded();

      toggle("Select Project One");
      toggle("Select Project Two");
      expect(
        screen.getByRole("button", { name: "Delete Selected (2)" })
      ).toBeInTheDocument();

      confirmSingleDelete("Project One");

      await screen.findByRole("button", { name: "Delete Selected (1)" });
      expect(
        screen.getByRole("checkbox", { name: "Select all projects" })
      ).toBeChecked();
    });

    it("clears the selection when the only selected project is deleted", async () => {
      mockFetch();
      await renderLoaded();

      toggle("Select Project One");
      confirmSingleDelete("Project One");

      await waitFor(() =>
        expect(screen.queryByText("Project One")).not.toBeInTheDocument()
      );
      expect(
        screen.queryByRole("button", { name: /Delete Selected/ })
      ).not.toBeInTheDocument();
    });

    it("removes every bulk-deleted project from the table", async () => {
      mockFetch();
      await renderLoaded();

      toggle("Select all projects");
      fireEvent.click(screen.getByRole("button", { name: "Delete 2 Projects" }));

      await waitFor(() => {
        expect(screen.queryByText("Project One")).not.toBeInTheDocument();
        expect(screen.queryByText("Project Two")).not.toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: /Delete Selected/ })
      ).not.toBeInTheDocument();
    });

    it("keeps only the projects that failed in a partial bulk delete", async () => {
      mockFetch(["project-2"]);
      await renderLoaded();

      toggle("Select all projects");
      fireEvent.click(screen.getByRole("button", { name: "Delete 2 Projects" }));

      await waitFor(() =>
        expect(screen.queryByText("Project One")).not.toBeInTheDocument()
      );
      expect(screen.getByText("Project Two")).toBeInTheDocument();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Projects deleted",
          description: "Successfully deleted 1 project. Failed to delete 1.",
        })
      );
    });

    it("keeps every row when a bulk delete fails entirely", async () => {
      mockFetch(["project-1", "project-2"]);
      await renderLoaded();

      toggle("Select all projects");
      fireEvent.click(screen.getByRole("button", { name: "Delete 2 Projects" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Error" })
        )
      );
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Project Two")).toBeInTheDocument();
    });
  });

  it("exports feedback with mentor names resolved from mentor_id and no mentor emails", async () => {
    profilesIn.mockResolvedValue({ data: [{ uid: "mentor-2", display_name: "Grace Mentor" }], error: null });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: [
          {
            id: "project-1",
            project_name: "Project One",
            lead_name: "Alice",
            lead_email: "alice@example.com",
            teammates: [],
            project_url: null,
            event_id: "event-1",
            created_at: "2026-04-01T00:00:00.000Z",
            submitted: true,
            project_tracks: [],
            feedback: [
              { feedback_text: "Nice", mentor_name: "Ada Mentor", mentor_id: "mentor-1" },
              { feedback_text: "Ship it", mentor_name: null, mentor_id: "mentor-2" },
            ],
          },
        ],
      }),
    });
    const createObjectURL = jest.fn(() => "blob:x");
    Object.assign(window.URL, { createObjectURL, revokeObjectURL: jest.fn() });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<SubmissionsTab eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Project One")).toBeInTheDocument());
    csvRows.length = 0;
    fireEvent.click(screen.getByRole("button", { name: /Export Feedback/ }));

    await waitFor(() => expect(csvRows).toHaveLength(1));
    const rows = csvRows[0] as Array<Record<string, string>>;
    expect(profilesIn).toHaveBeenCalledWith("uid", ["mentor-2"]);
    expect(rows.map((r) => r["Mentor Name"])).toEqual(["Ada Mentor", "Grace Mentor"]);
    expect(Object.keys(rows[0])).not.toContain("Mentor Email");
  });
});
