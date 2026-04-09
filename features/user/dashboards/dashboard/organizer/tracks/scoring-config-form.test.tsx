import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScoringConfigForm } from "./scoring-config-form";
import { EventTrack } from "@/lib/types";

const toast = jest.fn();
const from = jest.fn();
const projectTracksUpsert = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
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

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock("@/components/ui/select", () => {
  const SelectItem = ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>;

  const collectOptions = (children: React.ReactNode): React.ReactNode[] => {
    const options: React.ReactNode[] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) {
        return;
      }

      if (child.type === "option") {
        options.push(child);
        return;
      }

      if (child.type === SelectItem) {
        options.push(
          <option key={child.props.value} value={child.props.value}>
            {child.props.children}
          </option>
        );
        return;
      }

      options.push(
        ...collectOptions((child.props as { children?: React.ReactNode }).children)
      );
    });

    return options;
  };

  return {
    Select: ({
      children,
      value,
      onValueChange,
      disabled,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
      disabled?: boolean;
    }) => (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        <option value="">Select...</option>
        {collectOptions(children)}
      </select>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
  };
});

describe("ScoringConfigForm", () => {
  const savedTrack: EventTrack = {
    track_id: "track-1",
    event_id: "event-1",
    name: "AI Track",
    description: "AI projects",
    scoring_criteria: {
      name: "AI Track",
      criteria: [],
    },
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    projectTracksUpsert.mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ id: "project-1" }, { id: "project-2" }],
              error: null,
            }),
          }),
        };
      }

      if (table === "project_tracks") {
        return {
          upsert: projectTracksUpsert,
        };
      }

      if (table === "event_tracks") {
        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn(),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("bulk assigns a saved track to every event project", async () => {
    render(
      <ScoringConfigForm
        initialConfig={{
          tracks: {
            "track-1": {
              name: "AI Track",
              criteria: [],
            },
          },
          defaultMin: 0,
          defaultMax: 10,
          defaultWeight: 1,
        }}
        onSave={jest.fn()}
        tracks={[savedTrack]}
        isArchived={false}
        eventId="event-1"
      />
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "track-1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Assign All Projects" })
    );

    await waitFor(() => {
      expect(projectTracksUpsert).toHaveBeenCalledWith(
        [
          { project_id: "project-1", track_id: "track-1" },
          { project_id: "project-2", track_id: "track-1" },
        ],
        {
          onConflict: "project_id,track_id",
          ignoreDuplicates: false,
        }
      );
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Success",
      description: "Successfully assigned 2 project(s) to this track.",
    });
  });
});
