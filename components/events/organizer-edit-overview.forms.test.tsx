import { fireEvent, render, screen } from "@testing-library/react";
import { OrganizerEditOverview } from "./organizer-edit-overview";
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/events/sample/overview",
  useSearchParams: () => mockSearchParams,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/participants",
  () => ({ ParticipantsTab: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/teams", () => ({
  OrganizerTeamsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/access", () => ({
  AccessTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/tracks", () => ({
  EventTracksContainer: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/submissions", () => ({
  SubmissionsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/scores", () => ({
  ScoresTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab",
  () => ({ PricingTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/email", () => ({
  EmailTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton",
  () => ({ ProjectImport: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/submissions/SubmissionFieldsSettings",
  () => ({ SubmissionFieldsSettings: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/BasicInfoTab",
  () => ({ BasicInfoTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ContentTab",
  () => ({ ContentTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab",
  () => ({ ScheduleTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab",
  () => ({ ResourcesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/RulesTab",
  () => ({ RulesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/FAQTab",
  () => ({ FAQTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/registration",
  () => ({ IntakeResponsesTab: () => null }),
);
jest.mock("@/components/events/event-card", () => ({ EventCard: () => null }));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/api-keys/ApiKeysTab",
  () => ({ ApiKeysTab: () => null }),
);
jest.mock("@/features/intake-forms/components/IntakeFormBuilder", () => ({
  IntakeFormBuilder: () => null,
}));
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({
          data: {
            event_id: "sample",
            event_tracks: [],
            visibility: "public",
            approval_status: "approved",
          },
        }),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ count: 0 }).then(resolve),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mockReplace.mockClear();
  localStorage.clear();
});

it.each(["forms", "intake-forms"])(
  "opens the Forms overview for the %s URL",
  async (tab) => {
    mockSearchParams = new URLSearchParams({ tab, view: "organizer" });
    render(<OrganizerEditOverview eventId="sample" />);
    expect(
      await screen.findByRole("heading", { name: "Event forms" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Forms" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Manage submission form" }),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      `/events/sample/overview?tab=${tab}&view=organizer&subtab=submission`,
      { scroll: false },
    );
  },
);

it("exposes Forms from the default People view and preserves unrelated URL parameters", async () => {
  mockSearchParams = new URLSearchParams({ view: "organizer" });
  render(<OrganizerEditOverview eventId="sample" />);
  fireEvent.mouseDown(await screen.findByRole("tab", { name: "Forms" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(mockReplace).toHaveBeenCalledWith(
    "/events/sample/overview?view=organizer&tab=forms",
    { scroll: false },
  );
});
