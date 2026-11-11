import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ParticipantsTab } from "./index";
import { buildParticipantsCsv } from "./export";
import { fakeEventUsersResponse } from "@/lib/events/fake-event-users-api";
import type { EventDetails } from "@/lib/types";

jest.mock("@/lib/supabase", () => {
  const projects = {
    select: () => projects,
    eq: () => projects,
    overrideTypes: async () => ({ data: [], error: null }),
  };
  return {
    supabase: {
      from: () => projects,
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
    },
  };
});

jest.mock("@/lib/hooks/use-toast", () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("./ApprovalRequestsTab", () => ({ ApprovalRequestsTab: () => null }));
jest.mock("./ApprovalSettingsTab", () => ({ ApprovalSettingsTab: () => null }));
jest.mock("../assign", () => ({ AssignTab: () => null }));
// The dialog has its own tests; its form pulls in react-markdown (ESM), which
// this suite does not need to transform.
jest.mock("./SubmitForParticipantDialog", () => ({
  SubmitForParticipantDialog: ({
    participantUserId,
    participantDisplayName,
  }: {
    participantUserId: string;
    participantDisplayName: string;
  }) => (
    <div role="dialog" data-user-id={participantUserId}>
      Submit for {participantDisplayName}
    </div>
  ),
}));
jest.mock("../roles/EvidenceLetterDialog", () => ({
  EvidenceLetterDialog: () => null,
}));

jest.mock("./export", () => ({
  ...jest.requireActual("./export"),
  buildParticipantsCsv: jest.fn(() => ""),
}));

describe("ParticipantsTab", () => {
  beforeEach(() => {
    // jsdom has no fetch for jest.spyOn to wrap.
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return (
        url.includes("/users?")
          ? fakeEventUsersResponse(url, 501)
          : { ok: false, status: 404, json: async () => ({}) }
      ) as unknown as Response;
    });
    window.URL.createObjectURL = jest.fn(() => "blob:csv");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exports and copies every member of an event larger than one API page", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(
      <ParticipantsTab
        eventId="event-1"
        event={{} as EventDetails}
        setEvent={jest.fn()}
        isArchived={false}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: /registration/i })
      ).toHaveTextContent("501")
    );

    screen.getByRole("button", { name: /export csv/i }).click();
    expect(anchorClick).toHaveBeenCalled();
    expect((buildParticipantsCsv as jest.Mock).mock.calls[0][0]).toHaveLength(501);

    screen.getByRole("button", { name: /copy emails/i }).click();
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0].split(", ")).toHaveLength(501);
  });

  describe("submit on behalf of a participant", () => {
    const members = [
      { user_id: "user-p", role: "participant", display_name: "Pat Participant" },
      { user_id: "user-m", role: "mentor", display_name: "Max Mentor" },
      { user_id: "user-j", role: "judge", display_name: "Jo Judge" },
      { user_id: "user-o", role: "organizer", display_name: "Olive Organizer" },
    ].map((m) => ({
      ...m,
      uid: m.user_id,
      email: `${m.user_id}@example.com`,
      affiliation: "",
      team_name: "",
    }));

    beforeEach(() => {
      jest.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        return (
          url.includes("/users?")
            ? {
                ok: true,
                status: 200,
                json: async () => ({ users: members, count: members.length }),
              }
            : { ok: false, status: 404, json: async () => ({}) }
        ) as unknown as Response;
      });
    });

    const renderTab = (isArchived: boolean) =>
      render(
        <ParticipantsTab
          eventId="event-1"
          event={{} as EventDetails}
          setEvent={jest.fn()}
          isArchived={isArchived}
        />
      );

    it("offers the action only on participant rows and opens the dialog for that person", async () => {
      renderTab(false);
      const button = await screen.findByRole("button", {
        name: "Submit project for Pat Participant",
      });
      for (const name of ["Max Mentor", "Jo Judge", "Olive Organizer"]) {
        expect(
          screen.queryByRole("button", { name: `Submit project for ${name}` })
        ).not.toBeInTheDocument();
      }
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(button);
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Submit for Pat Participant");
      expect(dialog).toHaveAttribute("data-user-id", "user-p");
    });

    it("hides the action on archived events, which the API refuses", async () => {
      renderTab(true);
      await screen.findByText("Pat Participant");
      expect(
        screen.queryByRole("button", { name: /submit project for/i })
      ).not.toBeInTheDocument();
    });
  });
});
