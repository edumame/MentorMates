import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionEditor } from "./SubmissionEditor";
import type { SubmissionField } from "./types";

let latestFields: SubmissionField[];

function Harness() {
  const [fields, setFields] = useState<SubmissionField[]>([
    {
      id: "uploads",
      label: "Uploads",
      placeholder: "",
      type: "file",
      required: false,
      multiple: true,
      maxFiles: 5,
    },
  ]);
  latestFields = fields;
  return <SubmissionEditor fields={fields} onChange={setFields} />;
}

async function openMaxFiles(user: ReturnType<typeof userEvent.setup>) {
  render(<Harness />);
  await user.click(screen.getByText("Uploads"));
  return screen.getByRole("spinbutton");
}

describe("SubmissionEditor max files input", () => {
  beforeAll(() => {
    Element.prototype.scrollTo = jest.fn();
  });

  it("accepts a two-digit value typed one key at a time", async () => {
    const user = userEvent.setup();
    const input = await openMaxFiles(user);

    await user.clear(input);
    await user.keyboard("12");
    await user.tab();

    expect(input).toHaveValue(12);
    expect(latestFields[0].maxFiles).toBe(12);
  });

  it("clamps out-of-range values when the field loses focus", async () => {
    const user = userEvent.setup();
    const input = await openMaxFiles(user);

    await user.clear(input);
    await user.keyboard("25");
    await user.tab();
    expect(input).toHaveValue(20);
    expect(latestFields[0].maxFiles).toBe(20);

    await user.clear(input);
    await user.keyboard("1");
    await user.tab();
    expect(input).toHaveValue(2);
    expect(latestFields[0].maxFiles).toBe(2);
  });
});
