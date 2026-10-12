import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
      })
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
});
