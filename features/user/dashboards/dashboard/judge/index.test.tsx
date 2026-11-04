import { fireEvent, render, screen } from "@testing-library/react";
import { JudgeDashboard } from "./index";

const mockTables: Record<string, unknown> = {
  event_tracks: [{ track_id: "track-1", name: "Main", scoring_criteria: null }],
  events: { finalist_recommendation_enabled: false, scoring_config: null },
  project_assignments: [{ project_id: "project-1" }, { project_id: "project-2" }],
  project_round_advancements: [],
  projects: [
    {
      id: "project-1",
      project_name: "Alpha",
      project_description: "",
      created_at: "2026-01-01T00:00:00Z",
      event_id: "event-1",
      cover_image_url: null,
      project_url: null,
      video_url: null,
      project_tracks: [{ track_id: "track-1" }],
    },
    {
      id: "project-2",
      project_name: "Beta",
      project_description: "",
      created_at: "2026-01-01T00:00:00Z",
      event_id: "event-1",
      cover_image_url: null,
      project_url: null,
      video_url: null,
      project_tracks: [{ track_id: "track-1" }],
    },
  ],
  project_scores: [],
};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "judge-1" } } },
          error: null,
        }),
    },
    from: (table: string) => {
      const result = Promise.resolve({ data: mockTables[table], error: null });
      const query: Record<string, unknown> = {
        then: result.then.bind(result),
      };
      ["select", "eq", "in", "maybeSingle", "overrideTypes"].forEach((method) => {
        query[method] = () => query;
      });
      return query;
    },
  },
}));

// Stands in for the real form: like it, this holds its draft only in component
// state, so a project switch (which remounts it by key) drops what was typed.
jest.mock("@/components/project-scoring/default-scoring", () => ({
  DefaultScoring: ({ projectId }: { projectId: string }) => (
    <form data-testid={`scoring-${projectId}`}>
      <div role="slider" tabIndex={0} aria-valuenow={5} aria-label="Score" />
      <textarea aria-label="Comments" />
      <button type="submit">Submit Evaluation</button>
    </form>
  ),
}));

async function renderDashboard() {
  render(<JudgeDashboard eventId="event-1" />);
  await screen.findByText("Card 1 of 2");
  expect(screen.getAllByTestId("scoring-project-1").length).toBeGreaterThan(0);
}

describe("JudgeDashboard arrow key navigation", () => {
  it("moves to the next and previous card when focus is on the page", async () => {
    await renderDashboard();

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(await screen.findByText("Card 2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(await screen.findByText("Card 1 of 2")).toBeInTheDocument();
  });

  it("keeps working after the Next project button was clicked", async () => {
    await renderDashboard();

    const nextButton = screen.getByRole("button", { name: "Next project" });
    fireEvent.click(nextButton);
    expect(await screen.findByText("Card 2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(nextButton, { key: "ArrowRight" });
    expect(await screen.findByText("Card 1 of 2")).toBeInTheDocument();
  });

  it("keeps the unsaved comment when arrows move the caret in Comments", async () => {
    await renderDashboard();

    const comments = screen.getAllByLabelText("Comments")[0];
    fireEvent.change(comments, { target: { value: "Strong demo" } });

    fireEvent.keyDown(comments, { key: "ArrowLeft" });
    fireEvent.keyDown(comments, { key: "ArrowRight" });

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    expect(comments).toBeInTheDocument();
    expect(comments).toHaveValue("Strong demo");
  });

  it.each([
    ["score slider", () => screen.getAllByRole("slider")[0]],
    [
      "submit button",
      () => screen.getAllByRole("button", { name: "Submit Evaluation" })[0],
    ],
    [
      "search box",
      () => screen.getByPlaceholderText("Search project cards..."),
    ],
    ["sort select", () => screen.getByLabelText("Sort projects")],
  ])("does not switch projects from the %s", async (_name, getTarget) => {
    await renderDashboard();

    fireEvent.keyDown(getTarget(), { key: "ArrowRight" });

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
  });
});
