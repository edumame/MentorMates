import { fireEvent, render, screen } from "@testing-library/react";
import { ParticipantIntakeDialog } from "./ParticipantIntakeDialog";
import type { IntakeFormSchema } from "../types";

const schema: IntakeFormSchema = {
  title: "RSVP",
  description: "Synthetic local RSVP form",
  fields: [
    {
      id: "notes",
      key: "notes",
      label: "Notes",
      type: "long_text",
      required: false,
    },
    {
      id: "confirm",
      key: "confirm",
      label: "Confirm",
      type: "checkbox",
      required: false,
    },
  ],
};
const props = {
  schema,
  open: true as const,
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(undefined),
};
it("hydrates saved answers and uses defaults for missing fields", () => {
  render(
    <ParticipantIntakeDialog
      {...props}
      initialAnswers={{ notes: "Saved notes" }}
    />,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Saved notes");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("preserves in-progress answers across background prop refreshes", () => {
  const { rerender } = render(
    <ParticipantIntakeDialog
      {...props}
      initialAnswers={{ notes: "Saved notes" }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Unsaved edit" },
  });
  rerender(
    <ParticipantIntakeDialog
      {...props}
      initialAnswers={{ notes: "Saved notes" }}
    />,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Unsaved edit");
});

it("offers short_text options as suggestions and submits a free-text value (ORG-011)", async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <ParticipantIntakeDialog
      schema={{
        title: "Registration",
        fields: [
          {
            id: "school",
            key: "school",
            label: "School",
            type: "short_text",
            required: true,
            options: ["Listed University", "Other College"],
          },
        ],
      }}
      open
      onClose={jest.fn()}
      onSubmit={onSubmit}
    />
  );
  const input = screen.getByRole("combobox", { name: "School" });
  const listId = input.getAttribute("list");
  expect(listId).toBeTruthy();
  const datalist = document.getElementById(listId!);
  expect(datalist?.querySelectorAll("option")).toHaveLength(2);

  fireEvent.change(input, { target: { value: "Unlisted Academy" } });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await screen.findByRole("combobox", { name: "School" });
  expect(onSubmit).toHaveBeenCalledWith({ school: "Unlisted Academy" });
});

it("blocks submit while a required consent checkbox is unchecked (ORG-010 client side)", () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <ParticipantIntakeDialog
      schema={{
        title: "Registration",
        fields: [{ id: "coc", key: "coc", label: "I agree", type: "checkbox", required: true }],
      }}
      open
      onClose={jest.fn()}
      onSubmit={onSubmit}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).not.toHaveBeenCalled();
});

function buildSchema(dependentFieldKey: string): IntakeFormSchema {
  return {
    title: "Form",
    fields: [
      {
        id: "abc123-source",
        key: "attending_abc123",
        type: "short_text",
        label: "Attending",
        required: false,
        showIf: null,
      },
      {
        id: "def456-dependent",
        key: "dietary_def456",
        type: "short_text",
        label: "Dietary needs",
        required: true,
        showIf: { fieldKey: dependentFieldKey, equals: "Yes" },
      },
    ],
  };
}

describe("ParticipantIntakeDialog show-if rules", () => {
  it("hides a dependent question until its source answer matches", () => {
    render(
      <ParticipantIntakeDialog
        schema={buildSchema("attending_abc123")}
        open
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(screen.queryByText(/Dietary needs/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Yes" } });

    expect(screen.getByText(/Dietary needs/)).toBeInTheDocument();
  });

  it("shows and enforces a required question whose rule references a missing field", () => {
    const onSubmit = jest.fn();
    render(
      <ParticipantIntakeDialog
        schema={buildSchema("old_label_abc123")}
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Dietary needs/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
