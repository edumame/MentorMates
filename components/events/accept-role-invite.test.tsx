import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { AcceptRoleInvite } from "./accept-role-invite";
import { EventRole } from "@/lib/types";
import { RedirectProvider } from "@/features/user/authentication/redirect/RedirectProvider";
import { RETURN_URL_STORAGE_KEY } from "@/features/user/authentication/redirect/redirect-url";
import { supabase } from "@/lib/supabase";

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
    push: (...args: Parameters<typeof push>) => push(...args),
  }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const mockGetSession = jest.mocked(supabase.auth.getSession);

function renderInvite(ui: ReactElement) {
  return render(<RedirectProvider>{ui}</RedirectProvider>);
}

describe("AcceptRoleInvite", () => {
  beforeEach(() => {
    push.mockClear();
    mockGetSession.mockClear();
    localStorage.clear();
    window.history.replaceState({}, "", "/events/hack-night/accept-judge?token=abc");
  });

  it("renders the participant invite state", async () => {
    renderInvite(
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
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
  });

  it("renders the invalid-link state", async () => {
    renderInvite(
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
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
  });

  it("stores the current invite URL before sending unauthenticated users to login", async () => {
    renderInvite(
      <AcceptRoleInvite
        role={EventRole.Judge}
        eventId="event-1"
        eventName="Hack Night"
        eventBlurb="Build something ambitious."
        eventSlug="hack-night"
        invitedEmail="judge@email.com"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Sign In to Accept Invitation" })
    );

    expect(localStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe(
      "/events/hack-night/accept-judge?token=abc"
    );
    expect(push).toHaveBeenCalledWith("/login");
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
  });
});
