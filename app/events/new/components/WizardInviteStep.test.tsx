import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardInviteStep, getWizardShareLinks } from "./WizardInviteStep";
import {
  INITIAL_WIZARD_EVENT,
  type WizardEventData,
} from "@/lib/types/wizard";

function InviteStepHarness({ slug = "hack-night" }: { slug?: string } = {}) {
  const [event, setEvent] = useState<WizardEventData>({
    ...INITIAL_WIZARD_EVENT,
    event_name: "Hack Night",
    slug,
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

  it("shares QR codes that point at real /events/<slug> routes", () => {
    render(<InviteStepHarness />);

    const origin = window.location.origin;
    expect(
      screen.getByText(`${origin}/events/hack-night/overview`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${origin}/events/hack-night/submit`)
    ).toBeInTheDocument();
    // There is no judge-only route; judges join from the event page.
    expect(screen.queryByText(/\/judge$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Judge Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText(/Judges use the same event page link/)).toBeInTheDocument();
  });

  it("shows no QR codes when there is no slug instead of guessing a URL", () => {
    render(<InviteStepHarness slug="" />);

    expect(screen.getByTestId("share-links-unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/\/events\//)).not.toBeInTheDocument();
  });
});

describe("getWizardShareLinks", () => {
  it("builds event overview and submit links under /events/<slug>", () => {
    expect(
      getWizardShareLinks("https://mentormates.ai", "hack-night")?.map((l) => l.url)
    ).toEqual([
      "https://mentormates.ai/events/hack-night/overview",
      "https://mentormates.ai/events/hack-night/submit",
    ]);
  });

  it("normalises the slug the same way event creation saves it", () => {
    expect(
      getWizardShareLinks("https://mentormates.ai", "--Hack  Night--")?.[0].url
    ).toBe("https://mentormates.ai/events/hack-night/overview");
  });

  it("does not double the slash when the base URL ends with one", () => {
    expect(getWizardShareLinks("https://mentormates.ai/", "hack")?.[0].url).toBe(
      "https://mentormates.ai/events/hack/overview"
    );
  });

  it.each(["", "   ", "---"])("returns null for an empty slug %j", (slug) => {
    expect(getWizardShareLinks("https://mentormates.ai", slug)).toBeNull();
  });

  it("never produces a judge-only link", () => {
    const urls = getWizardShareLinks("https://x.test", "e")!.map((l) => l.url);
    expect(urls.some((u) => u.includes("/judge"))).toBe(false);
  });
});
