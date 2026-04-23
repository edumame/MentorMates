import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardInviteStep } from "./WizardInviteStep";
import {
  INITIAL_WIZARD_EVENT,
  type WizardEventData,
} from "@/lib/types/wizard";

function InviteStepHarness() {
  const [event, setEvent] = useState<WizardEventData>({
    ...INITIAL_WIZARD_EVENT,
    event_name: "Hack Night",
    slug: "hack-night",
  });

  return (
    <div>
      <WizardInviteStep event={event} setEvent={setEvent} />
      <div data-testid="participant-emails">
        {event.participant_invite_emails.join(",")}
      </div>
      <div data-testid="judge-emails">{event.judge_invite_emails.join(",")}</div>
    </div>
  );
}

describe("WizardInviteStep", () => {
  it("stores participant and judge invite emails in shared wizard state", async () => {
    const user = userEvent.setup();

    render(<InviteStepHarness />);

    await user.click(screen.getByRole("button", { name: "Participants" }));
    const participantInput = screen.getByPlaceholderText("participant@email.com");
    await user.type(participantInput, "Participant@Email.com{enter}");

    expect(screen.getByTestId("participant-emails")).toHaveTextContent(
      "participant@email.com"
    );
    expect(screen.getAllByText("participant@email.com")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Participants" }));
    expect(screen.getAllByText("participant@email.com")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Judges" }));
    const judgeInput = screen.getByPlaceholderText("judge@email.com");
    await user.type(judgeInput, "Judge@Email.com{enter}");

    expect(screen.getByTestId("judge-emails")).toHaveTextContent(
      "judge@email.com"
    );
  });
});
