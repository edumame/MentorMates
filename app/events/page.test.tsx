import { render, screen } from "@testing-library/react";
import EventsPage from "./page";
import { createSupabaseClient } from "../utils/supabase/server";

type Row = Record<string, unknown>;

const mockClientProps = jest.fn();

jest.mock("../utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
jest.mock("@/components/ui/discord-cta", () => ({ DiscordCTA: () => null }));

jest.mock("@/components/eventsPageClient", () => ({
  EventsPageClient: (props: { eventsList: Array<{ event_id: string }> }) => {
    mockClientProps(props);
    return <div data-testid="events-client" />;
  },
}));

const USER_ID = "user-1";

const event = (event_id: string, visibility: string, approval_status: string) => ({
  event_id,
  visibility,
  approval_status,
  event_date: "2026-12-01",
});

const EVENTS: Row[] = [
  event("public-approved", "public", "approved"),
  event("public-approved-joined", "public", "approved"),
  event("hosted-draft", "draft", "not_submitted"),
  event("joined-private", "private", "approved"),
  event("hosted-rejected", "public", "rejected"),
  event("stranger-draft", "draft", "not_submitted"),
  event("stranger-private", "private", "approved"),
];

const ROLES: Row[] = [
  { user_id: USER_ID, event_id: "hosted-draft", role: "organizer" },
  { user_id: USER_ID, event_id: "hosted-rejected", role: "organizer" },
  { user_id: USER_ID, event_id: "joined-private", role: "participant" },
  { user_id: USER_ID, event_id: "public-approved-joined", role: "mentor" },
];

/** Minimal PostgREST stand-in that really applies .eq/.in, so filters are exercised. */
function queryBuilder(rows: Row[], failure: unknown = null) {
  let result = rows;
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => {
      result = result.filter((row) => row[column] === value);
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      result = result.filter((row) => values.includes(row[column]));
      return builder;
    },
    then: (resolve: (value: { data: Row[] | null; error: unknown }) => unknown) =>
      resolve(failure ? { data: null, error: failure } : { data: result, error: null }),
  };
  return builder;
}

function mockSupabase({
  user = { id: USER_ID } as { id: string } | null,
  isAdmin = false,
  roles = ROLES,
}: { user?: { id: string } | null; isAdmin?: boolean; roles?: Row[] } = {}) {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async () => ({ data: isAdmin }),
    from: (table: string) => queryBuilder(table === "events" ? EVENTS : roles),
  });
}

async function renderedEvents() {
  render(await EventsPage());
  expect(screen.getByTestId("events-client")).toBeInTheDocument();
  const { eventsList } = mockClientProps.mock.calls[0][0] as {
    eventsList: Array<{ event_id: string; userRole: string | null }>;
  };
  return eventsList;
}

const ids = (events: Array<{ event_id: string }>) => events.map((e) => e.event_id).sort();

describe("EventsPage", () => {
  beforeEach(() => {
    mockClientProps.mockClear();
  });

  it("includes every event the user has a role in, whatever its visibility or approval", async () => {
    mockSupabase();

    const events = await renderedEvents();

    expect(ids(events)).toEqual(
      [
        "hosted-draft",
        "hosted-rejected",
        "joined-private",
        "public-approved",
        "public-approved-joined",
      ].sort()
    );
    expect(events.find((e) => e.event_id === "hosted-draft")?.userRole).toBe("organizer");
    expect(events.find((e) => e.event_id === "joined-private")?.userRole).toBe("participant");
  });

  it("lists an event once when it is both public and one the user joined", async () => {
    mockSupabase();

    const events = await renderedEvents();

    expect(events.filter((e) => e.event_id === "public-approved-joined")).toHaveLength(1);
  });

  it("only returns public approved events to a user without roles", async () => {
    mockSupabase({ roles: [] });

    expect(ids(await renderedEvents())).toEqual(["public-approved", "public-approved-joined"]);
  });

  it("only returns public approved events to signed-out visitors", async () => {
    mockSupabase({ user: null });

    expect(ids(await renderedEvents())).toEqual(["public-approved", "public-approved-joined"]);
  });

  it("tells the client whether the viewer is a global admin", async () => {
    mockSupabase({ isAdmin: true });

    const events = await renderedEvents();

    expect(events).toHaveLength(EVENTS.length);
    expect(mockClientProps.mock.calls[0][0].isGlobalAdmin).toBe(true);
  });
});
