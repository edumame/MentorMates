import { act, render, screen } from "@testing-library/react";
import PublicProjectPage from "./page";

type Row = Record<string, unknown>;

const PROJECT_ID = "project-1";
const EVENT_ID = "event-1";
const USER_ID = "user-1";

let tables: Record<string, Row[]>;

// Minimal PostgREST stand-in: applies .eq/.in filters to the rows in `tables`.
function queryFor(table: string) {
  let rows = tables[table] ?? [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      rows = rows.filter((row) => row[column] === value);
      return query;
    },
    in: (column: string, values: unknown[]) => {
      rows = rows.filter((row) => values.includes(row[column]));
      return query;
    },
    is: (column: string, value: unknown) => {
      rows = rows.filter((row) => (row[column] ?? null) === value);
      return query;
    },
    limit: () => query,
    overrideTypes: () => query,
    single: async () => ({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: "no rows" },
    }),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return query;
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => queryFor(table),
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
    },
  },
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/components/project-scoring/default-scoring", () => ({
  DefaultScoring: () => <div>scoring form</div>,
}));
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));
jest.mock("@/features/projects/components/feedback/FeedbackDisplay", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  "@/features/projects/components/feedback/GiveFeedbackDialog",
  () => ({ GiveFeedbackDialog: () => null })
);
jest.mock(
  "@/features/projects/components/management/project-dashboard/hooks/useQRCodeActions",
  () => ({
    useQRCodeActions: () => ({
      handleCopyQR: jest.fn(),
      handleDownloadQR: jest.fn(),
    }),
  })
);
jest.mock("@/features/projects/hooks/use-project-like", () => ({
  useProjectLike: () => ({
    liked: false,
    count: 0,
    isLoading: false,
    toggleLike: jest.fn(),
  }),
}));

function seed({
  role = "judge",
  activeRound = 2,
  submitted = true,
  advancedProjectIds = [PROJECT_ID],
  assigned = true,
}: {
  role?: string;
  activeRound?: number;
  submitted?: boolean;
  advancedProjectIds?: string[];
  assigned?: boolean;
}) {
  tables = {
    events: [
      {
        event_id: EVENT_ID,
        event_name: "Hack",
        event_date: "2026-01-01",
        scoring_config: { activeRound },
      },
    ],
    user_event_roles: [{ user_id: USER_ID, event_id: EVENT_ID, role }],
    project_tracks: [
      {
        project_id: PROJECT_ID,
        track_id: "track-1",
        event_tracks: {
          track_id: "track-1",
          event_id: EVENT_ID,
          name: "Main",
          scoring_criteria: { criteria: [] },
        },
      },
    ],
    project_round_advancements: advancedProjectIds.map((project_id) => ({
      event_id: EVENT_ID,
      project_id,
      round_number: activeRound,
    })),
    projects: [{ id: PROJECT_ID, event_id: EVENT_ID, submitted }],
    project_assignments: assigned
      ? [
          {
            project_id: PROJECT_ID,
            event_id: EVENT_ID,
            user_id: USER_ID,
            role: "judge",
          },
        ]
      : [],
  };

  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      project: {
        id: PROJECT_ID,
        event_id: EVENT_ID,
        project_name: "Alpha",
        project_description: "Description",
        lead_name: "Lead",
        lead_email: "lead@example.com",
        teammates: [],
        submitted,
      },
    }),
  })) as unknown as typeof fetch;
}

async function renderJudgeView() {
  render(<PublicProjectPage />);
  await screen.findByText("Judge View");
  // Let the eligibility lookup that follows the role check finish, so a hidden
  // tab means "checked and refused" rather than "not checked yet".
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("public project page judge scoring", () => {
  it("shows scoring for an assigned project advanced to the active round", async () => {
    seed({});
    await renderJudgeView();

    expect(
      await screen.findByRole("tab", { name: "Judge Scoring" })
    ).toBeInTheDocument();
  });

  it("hides scoring for a project eliminated before the active round", async () => {
    seed({ advancedProjectIds: ["another-project"] });
    await renderJudgeView();

    expect(
      screen.queryByRole("tab", { name: "Judge Scoring" })
    ).not.toBeInTheDocument();
  });

  it("hides scoring for a draft in round 1", async () => {
    seed({ activeRound: 1, advancedProjectIds: [], submitted: false });
    await renderJudgeView();

    expect(
      screen.queryByRole("tab", { name: "Judge Scoring" })
    ).not.toBeInTheDocument();
  });

  it("hides scoring for a judge who is not assigned to the project", async () => {
    seed({ assigned: false });
    // An unassigned judge gets the visitor view (canShowProjectScoring), so
    // wait for the page and the role lookup instead of the judge banner.
    render(<PublicProjectPage />);
    await screen.findByText("Alpha");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByText("Judge View")).not.toBeInTheDocument();

    expect(
      screen.queryByRole("tab", { name: "Judge Scoring" })
    ).not.toBeInTheDocument();
  });

  it("lets an organizer score an eligible project without an assignment", async () => {
    seed({ role: "organizer", assigned: false });
    await renderJudgeView();

    expect(
      await screen.findByRole("tab", { name: "Judge Scoring" })
    ).toBeInTheDocument();
  });
});
