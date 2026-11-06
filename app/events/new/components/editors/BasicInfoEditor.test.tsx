import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BasicInfoEditor } from "./BasicInfoEditor";
import {
  INITIAL_WIZARD_EVENT,
  type WizardEventData,
} from "@/lib/types/wizard";

function BasicInfoEditorHarness() {
  const [event, setEvent] = useState<WizardEventData>({
    ...INITIAL_WIZARD_EVENT,
    event_name: "Hack Night",
    slug: "hack-night",
  });

  return (
    <div>
      <BasicInfoEditor
        event={event}
        update={(fields) => setEvent((prev) => ({ ...prev, ...fields }))}
      />
      <div data-testid="max-projects">{String(event.max_projects)}</div>
    </div>
  );
}

describe("BasicInfoEditor", () => {
  it("stores the project submission cap in wizard state", async () => {
    const user = userEvent.setup();

    render(<BasicInfoEditorHarness />);

    const input = screen.getByLabelText(/project submission cap/i);
    await user.type(input, "12");

    expect(screen.getByTestId("max-projects")).toHaveTextContent("12");
  });
});
