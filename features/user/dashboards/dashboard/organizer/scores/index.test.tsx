import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toSpreadsheetSafeCsv } from "@/lib/utils/csv";
import type { EventScoringConfig } from "@/lib/types";
import { ScoresTab } from "./index";

type Row = Record<string, unknown>;

let tables: Record<string, Row[]>;
let saveAdvancements: () => void;
const mockChannel = jest.fn();

// Minimal PostgREST stand-in: applies .eq filters to the rows in `tables`.
function queryFor(table: string) {
  let rows = tables[table] ?? [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      // The score query filters through its embedded project relation.
      if (!column.includes(".")) {
        rows = rows.filter((row) => row[column] === value);
      }
      return query;
    },
    in: () => query,
    not: () => query,
    order: () => query,
    // Paged reads (fetchAllRows) stop on an empty page.
    range: (from: number, to: number) => {
      rows = rows.slice(from, to + 1);
      return query;
    },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    single: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return query;
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => queryFor(table),
    // Lead emails come from the project_team_emails RPC.
    rpc: async () => ({ data: [], error: null }),
    channel: (topic: string) => {
      mockChannel(topic);
      return {
        on() {
          return this;
        },
        subscribe() {
          return { unsubscribe: jest.fn() };
        },
      };
    },
  },
}));
jest.mock("@/components/events/rounds-editor", () => ({
  RoundsEditor: ({
    onAdvancementsSaved,
  }: {
    onAdvancementsSaved?: () => void;
  }) => {
    saveAdvancements = () => onAdvancementsSaved?.();
    return null;
  },
}));
jest.mock("@/components/voting/voting-results-panel", () => ({
  VotingResultsPanel: () => null,
}));
jest.mock("@/lib/utils/csv", () => ({
  toSpreadsheetSafeCsv: jest.fn(() => "csv"),
}));

const EVENT_ID = "event-1";

const scoringConfig: EventScoringConfig = {
  tracks: {
    main: {
      name: "Main",
      criteria: [
        {
          id: "impact",
          name: "Impact",
          description: "",
          weight: 1,
          min: 1,
          max: 10,
          type: "numeric",
          options: [],
        },
      ],
    },
  },
  defaultMin: 1,
  defaultMax: 10,
  defaultWeight: 1,
  rounds: [
    { round_number: 1, name: "Round 1", advancement_count: null },
    { round_number: 2, name: "Round 2", advancement_count: null },
  ],
  activeRound: 2,
};

function scoreRow(projectId: string, projectName: string, round: number) {
  return {
    project_id: projectId,
    track_id: "main",
    judge_id: "judge-1",
    created_at: "2026-01-01T00:00:00Z",
    scores: { impact: 8 },
    comments: null,
    round_number: round,
    projects: {
      project_name: projectName,
      lead_name: `${projectName} Lead`,
      lead_email: "lead@example.com",
      event_id: EVENT_ID,
    },
    event_tracks: { name: "Main", track_id: "main" },
  };
}

function seed() {
  tables = {
    event_tracks: [
      {
        track_id: "main",
        event_id: EVENT_ID,
        name: "Main",
        project_tracks: [
          {
            project_id: "advanced",
            projects: {
              id: "advanced",
              project_name: "Advanced",
              lead_name: "Advanced Lead",
            },
          },
          {
            project_id: "eliminated",
            projects: {
              id: "eliminated",
              project_name: "Eliminated",
              lead_name: "Eliminated Lead",
            },
          },
        ],
      },
    ],
    project_scores: [
      scoreRow("advanced", "Advanced", 1),
      scoreRow("eliminated", "Eliminated", 1),
      scoreRow("advanced", "Advanced", 2),
      scoreRow("eliminated", "Eliminated", 2),
    ],
    project_round_advancements: [
      { event_id: EVENT_ID, project_id: "advanced", round_number: 2 },
    ],
    projects: [
      { id: "advanced", event_id: EVENT_ID, submitted: true },
      { id: "eliminated", event_id: EVENT_ID, submitted: true },
    ],
    meetings: [],
  };
}

function exportAll() {
  (toSpreadsheetSafeCsv as jest.Mock).mockClear();
  for (const button of screen.getAllByRole("button", { name: /export/i })) {
    fireEvent.click(button);
  }
  return (toSpreadsheetSafeCsv as jest.Mock).mock.calls.map(([rows]) =>
    JSON.stringify(rows)
  );
}

describe("ScoresTab round eligibility", () => {
  beforeEach(() => {
    seed();
    mockChannel.mockClear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ profiles: [] }),
    })) as unknown as typeof fetch;
    window.URL.createObjectURL = jest.fn(() => "blob:scores");
    window.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps a project without a round 2 advancement out of the round 2 table", async () => {
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);

    expect(await screen.findByText("Advanced")).toBeInTheDocument();
    expect(screen.queryByText("Eliminated")).not.toBeInTheDocument();
  });

  it("exports round 1 history but not ineligible round 2 scores", async () => {
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);
    await screen.findByText("Advanced");

    const exported = exportAll();
    const eliminatedFiles = exported.filter((rows) =>
      rows.includes("Eliminated")
    );
    expect(exported.length).toBeGreaterThanOrEqual(4);
    // Round 1 ran before the cut, so its scores stay in the round 1 files
    // (one ranked, one raw) and nowhere else.
    expect(eliminatedFiles).toHaveLength(2);
  });

  it("drops a project from the table and exports when a re-pick removes it", async () => {
    tables.project_round_advancements.push({
      event_id: EVENT_ID,
      project_id: "eliminated",
      round_number: 2,
    });
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);
    expect(await screen.findByText("Eliminated")).toBeInTheDocument();
    // Ranked and raw files for both rounds.
    expect(
      exportAll().filter((rows) => rows.includes("Eliminated"))
    ).toHaveLength(4);

    tables.project_round_advancements =
      tables.project_round_advancements.filter(
        (row) => row.project_id !== "eliminated"
      );
    await act(async () => saveAdvancements());

    await waitFor(() =>
      expect(screen.queryByText("Eliminated")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    // Only the round 1 files still carry it.
    expect(
      exportAll().filter((rows) => rows.includes("Eliminated"))
    ).toHaveLength(2);
  });

  it("restores a project to the table and exports when a re-pick adds it back", async () => {
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);
    await screen.findByText("Advanced");
    expect(screen.queryByText("Eliminated")).not.toBeInTheDocument();

    tables.project_round_advancements.push({
      event_id: EVENT_ID,
      project_id: "eliminated",
      round_number: 2,
    });
    await act(async () => saveAdvancements());

    expect(await screen.findByText("Eliminated")).toBeInTheDocument();
    expect(
      exportAll().filter((rows) => rows.includes("Eliminated"))
    ).toHaveLength(4);
  });

  it("empties the round 2 table when a re-pick removes every project", async () => {
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);
    await screen.findByText("Advanced");

    tables.project_round_advancements = [];
    await act(async () => saveAdvancements());

    await waitFor(() =>
      expect(screen.queryByText("Advanced")).not.toBeInTheDocument()
    );
  });

  it("keeps the realtime channels when a re-pick reloads scores", async () => {
    render(<ScoresTab eventId={EVENT_ID} scoringConfig={scoringConfig} />);
    await screen.findByText("Advanced");
    const channelsOpened = mockChannel.mock.calls.length;

    tables.project_round_advancements = [];
    await act(async () => saveAdvancements());
    await waitFor(() =>
      expect(screen.queryByText("Advanced")).not.toBeInTheDocument()
    );

    expect(mockChannel).toHaveBeenCalledTimes(channelsOpened);
  });
});
