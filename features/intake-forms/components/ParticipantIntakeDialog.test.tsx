import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ParticipantIntakeDialog } from "./ParticipantIntakeDialog";
import type { IntakeFormField, IntakeFormSchema } from "../types";

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

function makeSchema(field: Partial<IntakeFormField>): IntakeFormSchema {
  return {
    title: "Questionnaire",
    fields: [
      {
        id: "field-1",
        key: "choice",
        type: "single_select",
        label: "Pick one",
        required: true,
        ...field,
      },
    ],
  };
}

function renderDialog(schema: IntakeFormSchema, onSubmit = jest.fn()) {
  render(
    <ParticipantIntakeDialog
      open
      onClose={jest.fn()}
      onSubmit={onSubmit}
      schema={schema}
    />
  );
  return onSubmit;
}

describe("ParticipantIntakeDialog blank options", () => {
  it("renders a dropdown whose saved options include an empty string", () => {
    renderDialog(makeSchema({ options: ["A", ""] }));

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("does not show blank rows for a multi select", () => {
    renderDialog(
      makeSchema({ type: "multi_select", options: ["A", "", "   "] })
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it.each(["single_select", "multi_select"] as const)(
    "does not block submit on a required %s with no usable options",
    async (type) => {
      const onSubmit = renderDialog(makeSchema({ type, options: ["", " "] }));

      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    }
  );

  it("still requires an answer when usable options exist", async () => {
    const onSubmit = renderDialog(makeSchema({ options: ["A", ""] }));

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText("Pick one").className).toContain("text-red-500")
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
