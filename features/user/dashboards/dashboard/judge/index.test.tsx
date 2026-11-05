import { fireEvent, render, screen, within } from "@testing-library/react";
import { JudgeDashboard } from "./index";

type MockScoreRow = {
  project_id: string;
  track_id: string;
  scores: Record<string, number>;
};

const mockTables: Record<string, unknown> = {};

function mockQuery(table: string) {
  const result = { data: mockTables[table] ?? [], error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  ["select", "eq", "in", "overrideTypes"].forEach((method) => {
    builder[method] = () => builder;
  });
  builder.maybeSingle = () =>
    Promise.resolve({ data: { scoring_config: null }, error: null });
  return builder;
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "judge-1" } } },
          error: null,
        }),
    },
    from: (table: string) => mockQuery(table),
  },
}));

jest.mock("@/components/project-scoring/default-scoring", () => ({
  DefaultScoring: ({
    projectId,
    trackId,
    onScoreSaved,
    onScoreDeleted,
  }: {
    projectId: string;
    trackId: string;
    onScoreSaved?: (scores: Record<string, number | string>) => void;
    onScoreDeleted?: () => void;
  }) => (
    <div>
      {[3, 9].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onScoreSaved?.({ quality: score })}
        >
          {`save ${projectId} ${trackId} ${score}`}
        </button>
      ))}
      <button type="button" onClick={() => onScoreDeleted?.()}>
        {`delete ${projectId} ${trackId}`}
      </button>
    </div>
  ),
}));

jest.mock(
  "@/features/projects/components/displays/cover-image-with-fallback",
  () => ({ CoverImageWithFallback: () => null })
);

const criteria = [
  { id: "quality", name: "Quality", type: "scale", weight: 1, min: 1, max: 10 },
];

function project(id: string, name: string, trackIds: string[]) {
  return {
    id,
    project_name: name,
    project_description: "",
    created_at: "2026-01-01T00:00:00Z",
    event_id: "event-1",
    cover_image_url: null,
    project_url: null,
    video_url: null,
    project_tracks: trackIds.map((track_id) => ({ track_id })),
  };
}

function seed(
  projects: ReturnType<typeof project>[],
  scores: MockScoreRow[]
): void {
  mockTables.event_tracks = ["track-a", "track-b"].map((track_id) => ({
    track_id,
    event_id: "event-1",
    name: track_id,
    description: "",
    scoring_criteria: { name: track_id, criteria },
  }));
  mockTables.project_assignments = projects.map(({ id }) => ({
    project_id: id,
  }));
  mockTables.project_round_advancements = [];
  mockTables.projects = projects;
  mockTables.project_scores = scores;
}

async function renderDashboard() {
  render(<JudgeDashboard eventId="event-1" />);
  await screen.findByText("Project Navigator");
  fireEvent.click(screen.getByRole("button", { name: /^All \(/ }));
}

function navigatorRows() {
  return screen
    .getAllByText(/Tracks scored/)
    .map((label) => label.closest("button") as HTMLButtonElement);
}

function navigatorRow(name: string) {
  const row = navigatorRows().find((button) =>
    within(button).queryByText(name)
  );
  if (!row) throw new Error(`No navigator row for ${name}`);
  return row;
}

function navigatorOrder() {
  return navigatorRows().map(
    (row) => row.querySelector("p")?.textContent ?? ""
  );
}

function sortBy(value: string) {
  fireEvent.change(screen.getByLabelText("Sort projects"), {
    target: { value },
  });
}

// The dashboard mounts a desktop and a mobile scoring form for the same track.
function clickAction(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name })[0]);
}

describe("JudgeDashboard navigator scores", () => {
  it("shows the average and re-sorts right after a first score is saved", async () => {
    seed(
      [
        project("p-alpha", "Alpha", ["track-a"]),
        project("p-beta", "Beta", ["track-a"]),
      ],
      [{ project_id: "p-beta", track_id: "track-a", scores: { quality: 5 } }]
    );
    await renderDashboard();
    sortBy("score_high");
    expect(navigatorOrder()).toEqual(["Beta", "Alpha"]);

    fireEvent.click(navigatorRow("Alpha"));
    clickAction("save p-alpha track-a 9");

    expect(navigatorRow("Alpha")).toHaveTextContent("Avg 9.0");
    expect(navigatorOrder()).toEqual(["Alpha", "Beta"]);
  });

  it("moves a newly scored project out of the unscored group", async () => {
    seed(
      [
        project("p-alpha", "Alpha", ["track-a"]),
        project("p-beta", "Beta", ["track-a"]),
      ],
      []
    );
    await renderDashboard();
    sortBy("unscored_first");
    expect(navigatorOrder()).toEqual(["Alpha", "Beta"]);

    fireEvent.click(navigatorRow("Alpha"));
    clickAction("save p-alpha track-a 9");

    expect(navigatorOrder()).toEqual(["Beta", "Alpha"]);
  });

  it("replaces the average and order when a score is edited", async () => {
    seed(
      [
        project("p-alpha", "Alpha", ["track-a"]),
        project("p-beta", "Beta", ["track-a"]),
      ],
      [
        { project_id: "p-alpha", track_id: "track-a", scores: { quality: 7 } },
        { project_id: "p-beta", track_id: "track-a", scores: { quality: 5 } },
      ]
    );
    await renderDashboard();
    sortBy("score_high");
    expect(navigatorOrder()).toEqual(["Alpha", "Beta"]);

    fireEvent.click(navigatorRow("Alpha"));
    clickAction("save p-alpha track-a 3");

    expect(navigatorRow("Alpha")).toHaveTextContent("Avg 3.0");
    expect(navigatorOrder()).toEqual(["Beta", "Alpha"]);
  });

  it("clears the average and re-sorts when the only score is deleted", async () => {
    seed(
      [
        project("p-alpha", "Alpha", ["track-a"]),
        project("p-beta", "Beta", ["track-a"]),
      ],
      [
        { project_id: "p-alpha", track_id: "track-a", scores: { quality: 7 } },
        { project_id: "p-beta", track_id: "track-a", scores: { quality: 5 } },
      ]
    );
    await renderDashboard();
    sortBy("score_high");

    fireEvent.click(navigatorRow("Alpha"));
    clickAction("delete p-alpha track-a");

    expect(navigatorRow("Alpha")).toHaveTextContent("Tracks scored 0/1");
    expect(navigatorRow("Alpha")).not.toHaveTextContent("Avg");
    expect(navigatorOrder()).toEqual(["Beta", "Alpha"]);
  });

  it("keeps the other track in the average when one track's score is deleted", async () => {
    seed(
      [project("p-alpha", "Alpha", ["track-a", "track-b"])],
      [
        { project_id: "p-alpha", track_id: "track-a", scores: { quality: 8 } },
        { project_id: "p-alpha", track_id: "track-b", scores: { quality: 4 } },
      ]
    );
    await renderDashboard();
    expect(navigatorRow("Alpha")).toHaveTextContent("Avg 6.0");

    clickAction("delete p-alpha track-a");

    expect(navigatorRow("Alpha")).toHaveTextContent("Tracks scored 1/2");
    expect(navigatorRow("Alpha")).toHaveTextContent("Avg 4.0");
  });
});
