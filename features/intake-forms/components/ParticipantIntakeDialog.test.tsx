import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import { createMLHComplianceTemplate } from "@/features/intake-forms/templates/mlhCompliance";
import { SCHOOL_OPTIONS } from "@/features/intake-forms/templates/mlhSchools";
import type { IntakeFormSchema } from "@/features/intake-forms/types";

const FALLBACK = "Other / Not listed";

// Radix Popover and cmdk rely on browser APIs that jsdom does not provide.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function getTemplateField(label: string) {
  const field = createMLHComplianceTemplate().fields.find(
    (candidate) => candidate.label === label
  );
  if (!field) throw new Error(`MLH template has no "${label}" field`);
  return field;
}

function renderWithField(label: string) {
  const field = getTemplateField(label);
  const schema: IntakeFormSchema = { title: "MLH", fields: [field] };
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(<ParticipantIntakeDialog schema={schema} open onClose={jest.fn()} onSubmit={onSubmit} />);
  return { field, onSubmit };
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

describe("MLH School field", () => {
  it("offers a fallback in the template without altering the verified list", () => {
    const field = getTemplateField("School");

    expect(field.required).toBe(true);
    expect(field.options).toContain(FALLBACK);
    expect(field.options?.filter((option) => option === FALLBACK)).toHaveLength(1);
    expect(SCHOOL_OPTIONS).not.toContain(FALLBACK);
  });

  it("does not let the required School field be skipped", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderWithField("School");

    await submit(user);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("lets a non-student pick the fallback as soon as the combobox opens", async () => {
    const user = userEvent.setup();
    const { field, onSubmit } = renderWithField("School");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: FALLBACK }));
    await submit(user);

    expect(onSubmit).toHaveBeenCalledWith({ [field.key]: FALLBACK });
  });

  it("lets someone at an unlisted school pick the fallback from a search with no matches", async () => {
    const user = userEvent.setup();
    const { field, onSubmit } = renderWithField("School");

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search school..."), "zzz-not-a-school");

    expect(screen.queryByText("No results found.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: FALLBACK }));
    await submit(user);

    expect(onSubmit).toHaveBeenCalledWith({ [field.key]: FALLBACK });
  });

  it("keeps the fallback reachable, once, when the search has many matches", async () => {
    const user = userEvent.setup();
    renderWithField("School");

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search school..."), "university");

    expect(screen.getAllByRole("option", { name: FALLBACK })).toHaveLength(1);
  });

  it("does not duplicate the fallback when the search matches it directly", async () => {
    const user = userEvent.setup();
    renderWithField("School");

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search school..."), "not listed");

    expect(screen.getAllByRole("option", { name: FALLBACK })).toHaveLength(1);
  });
});

describe("searchable field without a fallback", () => {
  it("still reports no results", async () => {
    const user = userEvent.setup();
    renderWithField("Country of Residence");

    await user.click(screen.getByRole("combobox"));
    await user.type(
      await screen.findByPlaceholderText("Search country of residence..."),
      "zzz-not-a-country"
    );

    expect(screen.getByText("No results found.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
