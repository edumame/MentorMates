import { render, screen } from "@testing-library/react";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getEventForRoute } from "@/lib/events/server-event";
import EventOverviewPage from "./page";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/events/server-event", () => ({ getEventForRoute: jest.fn() }));

jest.mock("next/navigation", () => ({ notFound: jest.fn() }));

jest.mock("@/components/events/event-page-layout", () => ({
  EventPageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/events/event-page-sidebar", () => ({
  EventPageSidebar: () => null,
}));

jest.mock("@/components/events/event-page-content", () => ({
  EventPageContent: ({
    judges,
  }: {
    judges: Array<{ id: string; name: string; affiliation?: string | null }>;
  }) => (
    <ul aria-label="judges">
      {judges.map((judge) => (
        <li key={judge.id}>
          {judge.name} / {judge.affiliation}
        </li>
      ))}
    </ul>
  ),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "in"]) {
    query[method] = () => query;
  }
  query.single = () => Promise.resolve(result);
  query.maybeSingle = () => Promise.resolve(result);
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

// What RLS gives a logged-out visitor or ordinary participant: the role row is
// visible, but user_profiles is not, so names come from the service client.
function mockViewerClient(judgeRows: unknown[]) {
  jest.mocked(getEventForRoute).mockResolvedValue({
    data: { event_id: "event-1", event_name: "Hack", slug: "hack" },
    error: null,
  } as never);
  mockCreateSupabaseClient.mockResolvedValue({
    rpc: async () => ({ data: [], error: null }),
    from: (table: string) => {
      if (table === "user_event_roles") {
        return queryResult({ data: judgeRows, error: null });
      }
      return queryResult({ data: [], error: null });
    },
    auth: { getUser: async () => ({ data: { user: null } }) },
  });
}

function mockServiceProfiles(profiles: unknown[]) {
  const from = jest.fn(() => queryResult({ data: profiles, error: null }));
  mockCreateServiceClient.mockReturnValue({ from });
  return from;
}

async function renderPage() {
  render(await EventOverviewPage({ params: Promise.resolve({ id: "hack" }) }));
}

describe("EventOverviewPage judges", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it("shows judges to viewers RLS hides their profiles from", async () => {
    mockViewerClient([{ user_id: "judge-1" }]);
    mockServiceProfiles([
      {
        uid: "judge-1",
        display_name: "Judy Judge",
        bio: null,
        avatar_url: null,
        affiliation: "ACME",
      },
    ]);

    await renderPage();

    expect(screen.getByText("Judy Judge / ACME")).toBeInTheDocument();
  });

  it("does not read profiles when the viewer can see no judge roles", async () => {
    mockViewerClient([]);
    const serviceFrom = mockServiceProfiles([]);

    await renderPage();

    expect(serviceFrom).not.toHaveBeenCalled();
    expect(screen.getByRole("list", { name: "judges" })).toBeEmptyDOMElement();
  });

  it("skips judges without a display name", async () => {
    mockViewerClient([{ user_id: "judge-1" }]);
    mockServiceProfiles([{ uid: "judge-1", display_name: null }]);

    await renderPage();

    expect(screen.getByRole("list", { name: "judges" })).toBeEmptyDOMElement();
  });

  it("still renders the page when the service key is missing", async () => {
    mockViewerClient([{ user_id: "judge-1" }]);
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error("supabaseKey is required.");
    });

    await renderPage();

    expect(screen.getByRole("list", { name: "judges" })).toBeEmptyDOMElement();
  });
});
