import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { AcceptRoleInvite } from "./accept-role-invite";
import { EventRole } from "@/lib/types";
import { RedirectProvider } from "@/features/user/authentication/redirect/RedirectProvider";
import { RETURN_URL_STORAGE_KEY } from "@/features/user/authentication/redirect/redirect-url";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/hooks/use-toast";

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

jest.mock("@/lib/hooks/use-toast", () => ({
  toast: jest.fn(),
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

  describe("accepting while signed in", () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    const supabaseWithFrom = supabase as unknown as { from?: jest.Mock };

    const mockResponse = (status: number, body: Record<string, unknown>) =>
      fetchMock.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      });

    const acceptInvite = async (
      role: EventRole.Participant | EventRole.Judge,
      buttonName: string
    ) => {
      renderInvite(
        <AcceptRoleInvite
          role={role}
          eventId="event-1"
          eventName="Hack Night"
          eventBlurb={null}
          eventSlug="hack-night"
        />
      );

      fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    };

    const acceptParticipantInvite = () =>
      acceptInvite(EventRole.Participant, "Accept Participant Invitation");

    beforeEach(() => {
      upsert.mockClear();
      fetchMock.mockReset();
      jest.mocked(toast).mockClear();
      global.fetch = fetchMock as unknown as typeof fetch;
      mockGetSession.mockResolvedValue({
        data: {
          session: { user: { id: "user-1", email: "person@example.com" } },
        },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      const query: Record<string, jest.Mock> = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert,
      };
      supabaseWithFrom.from = jest.fn(() => query);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      delete supabaseWithFrom.from;
      mockGetSession.mockResolvedValue({
        data: { session: null },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    });

    it("joins participants through /api/roles/verify, not a browser upsert", async () => {
      mockResponse(200, { success: true, requires_approval: false });

      await acceptParticipantInvite();

      expect(
        await screen.findByRole("heading", { name: "You're In!" })
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/roles/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eventId: "event-1",
            role: EventRole.Participant,
            userId: "user-1",
          }),
        })
      );
      expect(upsert).not.toHaveBeenCalled();
    });

    it.each([
      [402, "Payment required to join this event."],
      [412, "Please complete the registration questionnaire."],
      [400, "Password required for this role"],
    ])(
      "sends the user to the event page to finish joining on %i",
      async (status, error) => {
        mockResponse(status, { error });

        await acceptParticipantInvite();

        await waitFor(() =>
          expect(push).toHaveBeenCalledWith("/events/hack-night/overview")
        );
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: error })
        );
        expect(
          screen.queryByRole("heading", { name: "You're In!" })
        ).not.toBeInTheDocument();
        expect(upsert).not.toHaveBeenCalled();
      }
    );

    it("does not claim success when the join needs organizer approval", async () => {
      mockResponse(200, { success: true, requires_approval: true });

      await acceptParticipantInvite();

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/events/hack-night/overview")
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Request Submitted" })
      );
      expect(
        screen.queryByRole("heading", { name: "You're In!" })
      ).not.toBeInTheDocument();
    });

    it("shows the error and stays put on other failures", async () => {
      mockResponse(409, { error: "Event is full. No seats available." });

      await acceptParticipantInvite();

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Event is full. No seats available.",
          })
        )
      );
      expect(push).not.toHaveBeenCalled();
    });

    it("leaves judge invites on their existing path", async () => {
      await acceptInvite(EventRole.Judge, "Accept Judge Invitation");

      await waitFor(() => expect(upsert).toHaveBeenCalled());
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
