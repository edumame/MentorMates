import { fireEvent, render, screen } from "@testing-library/react";

import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import type { IntakeFormSchema } from "@/features/intake-forms/types";

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
