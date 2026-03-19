import { render, screen } from "@testing-library/react";
import { AcceptRoleInvite } from "./accept-role-invite";
import { EventRole } from "@/lib/types";

const push = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
      }),
    },
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

describe("AcceptRoleInvite", () => {
  it("renders the participant invite state", () => {
    render(
      <AcceptRoleInvite
        role={EventRole.Participant}
        eventId="event-1"
        eventName="Hack Night"
        eventBlurb="Build something ambitious."
        eventSlug="hack-night"
        invitedEmail="participant@email.com"
      />
    );

    expect(
      screen.getByRole("heading", { name: "You're invited to join" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign In to Accept Invitation" })
    ).toBeInTheDocument();
    expect(screen.getByText("participant@email.com")).toBeInTheDocument();
  });

  it("renders the invalid-link state", () => {
    render(
      <AcceptRoleInvite
        role={EventRole.Judge}
        eventId=""
        eventName=""
        eventBlurb={null}
        eventSlug={null}
        invitedEmail="judge@email.com"
        eventNotFound={true}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Event Link Changed" })
    ).toBeInTheDocument();
    expect(screen.getByText("judge@email.com")).toBeInTheDocument();
  });
});
