import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

jest.mock("@/lib/supabase", () => ({
  supabase: {
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
});
