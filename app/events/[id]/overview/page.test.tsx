import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import EventOverviewPage from "./page";

const EVENT_ID = "event-1";

type ProjectRow = {
  id: string;
  event_id: string;
  project_name: string;
  project_description: string | null;
  cover_image_url: string | null;
  submitted: boolean;
  submitted_at: string | null;
  created_at: string;
  lead_email: string;
  teammates: string[];
};

let projectRows: ProjectRow[] = [];
let currentUserEmail = "";
const projectOrFilters: string[] = [];

const makeProject = (overrides: Partial<ProjectRow>): ProjectRow => ({
  id: "project-1",
  event_id: EVENT_ID,
  project_name: "Team Project",
  project_description: null,
  cover_image_url: null,
  submitted: false,
  submitted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  lead_email: "alice@example.com",
  teammates: [],
  ...overrides,
});

// Evaluates the PostgREST `or` syntax this page sends, so a row is returned
// only when the query really asks for the lead or teammate match.
function matchesOrFilter(row: ProjectRow, filter: string) {
  return filter.split(",").some((clause) => {
    const lead = clause.match(/^lead_email\.eq\."(.*)"$/);
    if (lead) return row.lead_email === lead[1];
    const teammate = clause.match(/^teammates\.cs\.\{"(.*)"\}$/);
    if (teammate) return row.teammates.includes(teammate[1]);
    throw new Error(`Unexpected or clause: ${clause}`);
  });
}

function projectsQuery() {
  let rows = projectRows;
  const builder = {
    select: () => builder,
    eq: (column: keyof ProjectRow, value: unknown) => {
      rows = rows.filter((row) => row[column] === value);
      return builder;
    },
    or: (filter: string) => {
      projectOrFilters.push(filter);
      rows = rows.filter((row) => matchesOrFilter(row, filter));
      return builder;
    },
    then: (resolve: (result: { data: ProjectRow[]; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  };
  return builder;
}

// `single`/`maybeSingle` return `row`; awaiting the query itself returns a list.
function staticQuery(row: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    or: () => builder,
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null }),
  };
  return builder;
}

jest.mock("next/navigation", () => ({ notFound: jest.fn() }));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: currentUserEmail } },
      }),
    },
    from: (table: string) => {
      if (table === "projects") return projectsQuery();
      if (table === "events") {
        return staticQuery({
          event_id: EVENT_ID,
          event_name: "Hack",
          slug: "hack",
        });
      }
      if (table === "user_event_roles") {
        return staticQuery({ role: "participant" });
      }
      return staticQuery();
    },
  }),
}));

jest.mock("@/components/events/event-page-layout", () => ({
  EventPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/events/event-page-sidebar", () => ({
  EventPageSidebar: () => null,
}));

// Keeps the real UserProjectSection so the tests cover what the user sees.
jest.mock("@/components/events/event-page-content", () => {
  const { UserProjectSection } = jest.requireActual(
    "@/components/events/user-project-section",
  );
  return {
    EventPageContent: ({ userProjects }: { userProjects: unknown[] }) => (
      <UserProjectSection projects={userProjects} eventId="event-1" />
    ),
  };
});

async function renderOverview(email: string) {
  currentUserEmail = email;
  render(await EventOverviewPage({ params: Promise.resolve({ id: "hack" }) }));
}

describe("EventOverviewPage user projects", () => {
  beforeEach(() => {
    projectRows = [];
    projectOrFilters.length = 0;
  });

  it("shows a teammate the team's project instead of the no-project prompt", async () => {
    projectRows = [makeProject({ teammates: ["bob@example.com"] })];

    await renderOverview("bob@example.com");

    expect(screen.getByText("Team Project")).toBeInTheDocument();
    expect(
      screen.queryByText("You haven't created a project yet"),
    ).not.toBeInTheDocument();
  });

  it("still shows the lead their project", async () => {
    projectRows = [makeProject({ teammates: ["bob@example.com"] })];

    await renderOverview("alice@example.com");

    expect(screen.getByText("Team Project")).toBeInTheDocument();
  });

  it("lists a project once when the user is both lead and teammate", async () => {
    projectRows = [makeProject({ teammates: ["alice@example.com"] })];

    await renderOverview("alice@example.com");

    expect(screen.getAllByText("Team Project")).toHaveLength(1);
  });

  it("quotes the email so it stays one value in the or filter", async () => {
    await renderOverview("bob+hack@example.com");

    expect(projectOrFilters).toEqual([
      'lead_email.eq."bob+hack@example.com",teammates.cs.{"bob+hack@example.com"}',
    ]);
  });

  it("keeps the no-project prompt for someone outside the team", async () => {
    projectRows = [
      makeProject({ teammates: ["bob@example.com"] }),
      makeProject({
        id: "project-2",
        event_id: "other-event",
        project_name: "Other Event Project",
        teammates: ["carol@example.com"],
      }),
    ];

    await renderOverview("carol@example.com");

    expect(
      screen.getByText("You haven't created a project yet"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Team Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Other Event Project")).not.toBeInTheDocument();
  });
});
