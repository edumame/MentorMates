import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
jest.mock("@/components/ui/select", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const SelectContext = React.createContext<(value: string) => void>(() => {});
  return {
    Select: ({
      onValueChange,
      children,
    }: {
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => (
      <SelectContext.Provider value={onValueChange}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const onValueChange = React.useContext(SelectContext);
      return <button onClick={() => onValueChange(value)}>{children}</button>;
    },
  };
});

let mockEvent: Record<string, unknown>;
const mockUpdate = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        update: (values: unknown) => {
          mockUpdate(values);
          return query;
        },
        single: async () => ({ data: mockEvent }),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mockUpdate.mockClear();
  localStorage.clear();
  mockSearchParams = new URLSearchParams({
    tab: "access",
    subtab: "password",
    view: "organizer",
  });
});

async function chooseVisibility(name: string) {
  render(<OrganizerEditOverview eventId="sample" />);
  fireEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
}

it("withdraws a pending submission when the organizer sets Draft", async () => {
  mockEvent = {
    event_id: "sample",
    event_name: "Sample",
    event_tracks: [],
    visibility: "private",
    approval_status: "submitted",
  };

  await chooseVisibility("Draft");

  expect(mockUpdate).toHaveBeenCalledWith({
    visibility: "draft",
    approval_status: "not_submitted",
  });
  expect(await screen.findByText("NOT SUBMITTED")).toBeInTheDocument();
});

it("keeps a pending submission when the organizer keeps it Private", async () => {
  mockEvent = {
    event_id: "sample",
    event_name: "Sample",
    event_tracks: [],
    visibility: "private",
    approval_status: "submitted",
  };

  await chooseVisibility("Private");

  expect(mockUpdate).toHaveBeenCalledWith({ visibility: "private" });
});

it("keeps an approved status when the organizer sets Draft", async () => {
  mockEvent = {
    event_id: "sample",
    event_name: "Sample",
    event_tracks: [],
    visibility: "public",
    approval_status: "approved",
  };

  await chooseVisibility("Draft");

  expect(mockUpdate).toHaveBeenCalledWith({ visibility: "draft" });
});
