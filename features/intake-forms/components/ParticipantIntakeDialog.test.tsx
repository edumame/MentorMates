import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ParticipantIntakeDialog } from "./ParticipantIntakeDialog";
import type {
  IntakeFormField,
  IntakeFormSchema,
} from "@/features/intake-forms/types";

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
