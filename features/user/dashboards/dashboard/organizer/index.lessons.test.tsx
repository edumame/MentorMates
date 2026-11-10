import React from "react";
import { render, screen } from "@testing-library/react";
import { OrganizerDashboard } from "./index";

const lessonsResult = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/lib/hooks/use-event-archive-status", () => ({
  useEventArchiveStatus: () => ({ isArchived: false }),
}));

jest.mock("@/lib/events/build-event-scoring-config", () => ({
  buildEventScoringConfig: () => null,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
    },
    rpc: async () => ({ data: false }),
    from: (table: string) => ({
      select: () => {
        const eq = () => {
          if (table === "event_lessons") return lessonsResult();
          return {
            eq,
            maybeSingle: async () => ({ data: { role: "organizer" } }),
            single: async () => ({
              data: { event_id: "event-1" },
              error: null,
            }),
          };
        };
        return { eq };
      },
    }),
  },
}));

jest.mock("./details/BasicInfoTab", () => ({
  BasicInfoTab: ({
    event,
  }: {
    event: { event_lessons?: unknown[] };
  }) => (
    <p data-testid="lessons">
      {event.event_lessons === undefined
        ? "not loaded"
        : `${event.event_lessons.length} loaded`}
    </p>
  ),
}));

jest.mock("./submissions", () => ({ SubmissionsTab: () => null }));
jest.mock("./scores", () => ({ ScoresTab: () => null }));
jest.mock("./assign", () => ({ AssignTab: () => null }));
jest.mock("./tracks", () => ({ EventTracksContainer: () => null }));
jest.mock("./access", () => ({ AccessTab: () => null }));
jest.mock("./pricing/PricingTab", () => ({ PricingTab: () => null }));
jest.mock("./notifications/EmailDashboard", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("./agents/AgentsTab", () => ({ AgentsTab: () => null }));
jest.mock("./api-keys/ApiKeysTab", () => ({ ApiKeysTab: () => null }));
jest.mock("./registration", () => ({ IntakeResponsesTab: () => null }));
jest.mock("./details/ContentTab", () => ({ ContentTab: () => null }));
jest.mock("./details/ScheduleTab", () => ({ ScheduleTab: () => null }));
jest.mock("./details/ResourcesTab", () => ({ ResourcesTab: () => null }));
jest.mock("./details/RulesTab", () => ({ RulesTab: () => null }));
jest.mock("./details/FAQTab", () => ({ FAQTab: () => null }));

describe("OrganizerDashboard lesson loading", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("leaves event_lessons unset when the lessons query fails", async () => {
    lessonsResult.mockResolvedValue({ data: null, error: { message: "boom" } });

    render(<OrganizerDashboard eventId="event-1" />);

    expect(await screen.findByTestId("lessons")).toHaveTextContent("not loaded");
  });

  it("distinguishes an event with no lessons from a failed load", async () => {
    lessonsResult.mockResolvedValue({ data: [], error: null });

    render(<OrganizerDashboard eventId="event-1" />);

    expect(await screen.findByTestId("lessons")).toHaveTextContent("0 loaded");
  });
});
