import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompactScoringForm } from "./CompactScoringForm";
import type { EventScoringConfig } from "@/lib/types";

const toast = jest.fn();
const from = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

jest.mock("@/components/ui/button", () => ({
  // Used by the real AlertDialog (TrackDeleteDialog).
  buttonVariants: () => "",
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

jest.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
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
        {collectOptions(children)}
      </select>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
  };
});

describe("CompactScoringForm", () => {
  const multiRoundConfig: EventScoringConfig = {
    tracks: {
      "track-1": {
        name: "AI Track",
        criteria: [
          {
            id: "impact",
            name: "Impact",
            description: "Base impact",
            type: "numeric",
            weight: 1,
            min: 1,
            max: 10,
            options: [],
          },
        ],
      },
    },
    defaultMin: 1,
    defaultMax: 10,
    defaultWeight: 1,
    rounds: [
      { round_number: 1, name: "Qualifiers" },
      { round_number: 2, name: "Finals" },
    ],
    activeRound: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    from.mockImplementation(() => ({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn(),
      }),
    }));
  });

  it("shows a round selector when multiple rounds exist and saves overrides into that round", () => {
    const onSave = jest.fn();

    render(
      <CompactScoringForm
        initialConfig={multiRoundConfig}
        onSave={onSave}
        isArchived={false}
        eventId="event-1"
      />
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByText("Impact"));
    fireEvent.change(screen.getByDisplayValue("Impact"), {
      target: { value: "Final Demo" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: expect.objectContaining({
          "track-1": expect.objectContaining({
            criteria: [
              expect.objectContaining({
                name: "Impact",
              }),
            ],
          }),
        }),
        rounds: expect.arrayContaining([
          expect.objectContaining({
            round_number: 2,
            tracks: expect.objectContaining({
              "track-1": expect.objectContaining({
                criteria: [
                  expect.objectContaining({
                    name: "Final Demo",
                  }),
                ],
              }),
            }),
          }),
        ]),
      }),
      { descriptions: {} }
    );
  });

  it("lets a fractional weight be typed and a score range be retyped", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    render(
      <CompactScoringForm
        initialConfig={{
          ...multiRoundConfig,
          rounds: [{ round_number: 1, name: "Only Round" }],
        }}
        onSave={onSave}
        isArchived={false}
        eventId="event-1"
      />
    );

    fireEvent.click(screen.getByText("Impact"));
    const [weight, , maxScore] = screen.getAllByRole("spinbutton");

    await user.clear(weight);
    await user.keyboard("0.5");
    expect(weight).toHaveValue(0.5);

    await user.clear(maxScore);
    expect(maxScore).toHaveValue(null);
    await user.keyboard("5");

    fireEvent.click(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    );

    expect(onSave.mock.calls[0][0].tracks["track-1"].criteria[0]).toMatchObject(
      { weight: 0.5, max: 5 }
    );
  });

  it("hides the round selector when the event does not have multiple rounds", () => {
    render(
      <CompactScoringForm
        initialConfig={{
          ...multiRoundConfig,
          rounds: [{ round_number: 1, name: "Only Round" }],
        }}
        onSave={jest.fn()}
        isArchived={false}
        eventId="event-1"
      />
    );

    expect(screen.queryByText("Rubric")).not.toBeInTheDocument();
  });

  describe("track delete confirmation (ORG-021 / JUDGE-005)", () => {
    function mockTables(counts: { project_scores: number; project_tracks: number; prizes: number }) {
      const deleteEq = jest.fn().mockResolvedValue({ error: null });
      from.mockImplementation((table: string) => {
        if (table === "event_tracks") {
          return { delete: jest.fn().mockReturnValue({ eq: deleteEq }) };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: counts[table as keyof typeof counts],
              error: null,
            }),
          }),
        };
      });
      return deleteEq;
    }

    const renderForm = () =>
      render(
        <CompactScoringForm
          initialConfig={multiRoundConfig}
          onSave={jest.fn()}
          isArchived={false}
          eventId="event-1"
        />
      );

    it("does not delete on the first click and shows what will be lost", async () => {
      const deleteEq = mockTables({ project_scores: 0, project_tracks: 2, prizes: 1 });
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Delete track AI Track" }));
      expect(deleteEq).not.toHaveBeenCalled();
      const dialog = await screen.findByRole("alertdialog");
      await waitFor(() => expect(dialog).toHaveTextContent("0 judge scores, 1 prize"));
      expect(dialog).toHaveTextContent("2 projects");
      fireEvent.click(screen.getByRole("button", { name: "Delete track" }));
      await waitFor(() => expect(deleteEq).toHaveBeenCalledWith("track_id", "track-1"));
    });

    it("requires typing the track name once judges have scored it", async () => {
      const deleteEq = mockTables({ project_scores: 3, project_tracks: 1, prizes: 0 });
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Delete track AI Track" }));
      const dialog = await screen.findByRole("alertdialog");
      await waitFor(() => expect(dialog).toHaveTextContent("3 judge scores"));
      const confirm = screen.getByRole("button", { name: "Delete track" });
      expect(confirm).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "AI" } });
      expect(confirm).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "AI Track" } });
      expect(confirm).toBeEnabled();
      fireEvent.click(confirm);
      await waitFor(() => expect(deleteEq).toHaveBeenCalledTimes(1));
    });

    it("cancel keeps the track", async () => {
      const deleteEq = mockTables({ project_scores: 0, project_tracks: 0, prizes: 0 });
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Delete track AI Track" }));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(deleteEq).not.toHaveBeenCalled();
      expect(screen.getByText("AI Track")).toBeInTheDocument();
    });

    it("requires the typed name when the impact cannot be loaded", async () => {
      from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: null, error: { message: "boom" } }),
        }),
      }));
      jest.spyOn(console, "error").mockImplementation(() => {});
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Delete track AI Track" }));
      await screen.findByText(/couldn.t check/);
      expect(screen.getByRole("button", { name: "Delete track" })).toBeDisabled();
      expect(screen.getByLabelText(/to confirm/)).toBeInTheDocument();
    });

    it("the delete control is a keyboard-focusable button", () => {
      mockTables({ project_scores: 0, project_tracks: 0, prizes: 0 });
      renderForm();
      const button = screen.getByRole("button", { name: "Delete track AI Track" });
      expect(button.tagName).toBe("BUTTON");
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe("saved track details (JUDGE-006 / JUDGE-018)", () => {
    const savedTrack = {
      track_id: "track-1",
      event_id: "event-1",
      name: "Climate Track",
      description: "Build something for climate resilience",
      scoring_criteria: { name: "AI Track", criteria: [] },
      created_at: "",
      updated_at: "",
      prizes: [
        { id: "prize-1", track_id: "track-1", prize_amount: "$100", prize_description: "Best hack" },
      ],
    };

    it("shows the DB name/description and saves them unchanged", () => {
      const onSave = jest.fn();
      render(
        <CompactScoringForm
          initialConfig={{ ...multiRoundConfig, rounds: undefined }}
          onSave={onSave}
          isArchived={false}
          eventId="event-1"
          tracks={[savedTrack]}
        />
      );
      expect(screen.getByPlaceholderText("e.g., Best Overall")).toHaveValue("Climate Track");
      expect(screen.getByLabelText("Track description")).toHaveValue(
        "Build something for climate resilience"
      );
      fireEvent.click(screen.getByRole("button", { name: "Save Scoring Configuration" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: { "track-1": expect.objectContaining({ name: "Climate Track" }) },
        }),
        { descriptions: { "track-1": "Build something for climate resilience" } }
      );
    });

    it("saves an edited description", () => {
      const onSave = jest.fn();
      render(
        <CompactScoringForm
          initialConfig={{ ...multiRoundConfig, rounds: undefined }}
          onSave={onSave}
          isArchived={false}
          eventId="event-1"
          tracks={[savedTrack]}
        />
      );
      fireEvent.change(screen.getByLabelText("Track description"), {
        target: { value: "New copy" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save Scoring Configuration" }));
      expect(onSave.mock.calls[0][1]).toEqual({ descriptions: { "track-1": "New copy" } });
    });

    it("lists the track's prizes instead of a placeholder", () => {
      render(
        <CompactScoringForm
          initialConfig={{ ...multiRoundConfig, rounds: undefined }}
          onSave={jest.fn()}
          isArchived={false}
          eventId="event-1"
          tracks={[savedTrack]}
        />
      );
      expect(screen.getByText("$100")).toBeInTheDocument();
      expect(screen.queryByText(/No prizes added yet/)).toBeNull();
    });
  });

  describe("criterion editor with ids shared across tracks", () => {
    const sharedCriterion = (name: string) => ({
      id: "technical",
      name,
      description: "",
      type: "numeric" as const,
      weight: 1,
      min: 1,
      max: 10,
      options: [],
    });

    const sharedIdConfig: EventScoringConfig = {
      tracks: {
        "track-1": { name: "AI Track", criteria: [sharedCriterion("First Technical")] },
        "track-2": { name: "Web Track", criteria: [sharedCriterion("Second Technical")] },
      },
      defaultMin: 1,
      defaultMax: 10,
      defaultWeight: 1,
    };

    const renderForm = (onSave = jest.fn()) =>
      render(
        <CompactScoringForm
          initialConfig={sharedIdConfig}
          onSave={onSave}
          isArchived={false}
          eventId="event-1"
        />
      );

    it("opens only the clicked track's editor and focuses it", () => {
      renderForm();

      fireEvent.click(screen.getByText("First Technical"));

      expect(screen.getAllByText("Editing Criterion")).toHaveLength(1);
      expect(screen.getByText("Second Technical")).toBeInTheDocument();
      expect(document.activeElement).toBe(
        screen.getByDisplayValue("First Technical")
      );
    });

    it("opens the later track's editor alone when that one is clicked", () => {
      renderForm();

      fireEvent.click(screen.getByText("Second Technical"));

      expect(screen.getAllByText("Editing Criterion")).toHaveLength(1);
      expect(screen.getByText("First Technical")).toBeInTheDocument();
      expect(document.activeElement).toBe(
        screen.getByDisplayValue("Second Technical")
      );
    });

    it("moves the editor when another track's matching criterion is clicked", () => {
      renderForm();

      fireEvent.click(screen.getByText("First Technical"));
      fireEvent.click(screen.getByText("Second Technical"));

      expect(screen.getAllByText("Editing Criterion")).toHaveLength(1);
      expect(screen.getByText("First Technical")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Second Technical")).toBeInTheDocument();
    });

    it("saves edits only to the clicked track", () => {
      const onSave = jest.fn();
      renderForm(onSave);

      fireEvent.click(screen.getByText("First Technical"));
      fireEvent.change(document.activeElement as HTMLInputElement, {
        target: { value: "Renamed" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Save Scoring Configuration" })
      );

      const saved = onSave.mock.calls[0][0] as EventScoringConfig;
      expect(saved.tracks["track-1"].criteria[0].name).toBe("Renamed");
      expect(saved.tracks["track-2"].criteria[0].name).toBe("Second Technical");
    });
  });
});
