import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import VotingPage from "./page";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/components/events/event-page-layout", () => ({
  EventPageLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/voting/voting-results-panel", () => ({
  VotingResultsPanel: () => null,
}));

jest.mock("@/components/voting/voting-content", () => ({
  VotingContent: ({
    hasJoined,
    isPublicEvent,
  }: {
    hasJoined: boolean;
    isPublicEvent: boolean;
  }) => (
    <div
      data-testid="voting-content"
      data-joined={String(hasJoined)}
      data-public={String(isPublicEvent)}
    />
  ),
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

// Returns only the columns the page selects, like the real client, so dropping
// visibility from the select fails these tests.
function mockSupabase(visibility: string) {
  const eventRow: Record<string, unknown> = {
    event_id: EVENT_ID,
    event_name: "Hack",
    owner_id: "owner-1",
    visibility,
  };

  const eventsQuery = (columns: string) => {
    const selected = Object.fromEntries(
      Object.entries(eventRow).filter(([key]) => columns.includes(key))
    );
    const builder = {
      or: () => builder,
      eq: () => builder,
      single: async () => ({ data: selected, error: null }),
    };
    return builder;
  };

  const rolesQuery = {
    eq: () => rolesQuery,
    maybeSingle: async () => ({ data: { role: "participant" } }),
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    from: (table: string) => ({
      select: (columns: string) =>
        table === "events" ? eventsQuery(columns) : rolesQuery,
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
  });
}

async function renderPage() {
  render(
    await VotingPage({
      params: Promise.resolve({ id: EVENT_ID }),
      searchParams: Promise.resolve({}),
    })
  );
  return screen.getByTestId("voting-content");
}

describe("VotingPage", () => {
  it("tells VotingContent when the event is public", async () => {
    mockSupabase("public");

    const content = await renderPage();

    expect(content).toHaveAttribute("data-joined", "true");
    expect(content).toHaveAttribute("data-public", "true");
  });

  it.each(["private", "draft"])(
    "tells VotingContent that a %s event is not public",
    async (visibility) => {
      mockSupabase(visibility);

      const content = await renderPage();

      expect(content).toHaveAttribute("data-public", "false");
    }
  );
});
