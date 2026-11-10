import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DefaultScoring } from "./default-scoring";

const criteria = [
  { id: "quality", name: "Quality", type: "scale", weight: 1, min: 1, max: 10 },
];

const mockResults: Record<string, { data: unknown; error: null }> = {};

function mockQuery(table: string) {
  const result = () => mockResults[table] ?? { data: null, error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(result()),
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
  };
  ["select", "eq", "insert", "update", "delete"].forEach((method) => {
    builder[method] = () => builder;
  });
  return builder;
}

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => mockQuery(table) },
}));

jest.mock("@/lib/hooks/use-toast", () => {
  const toast = jest.fn();
  return { useToast: () => ({ toast }) };
});

jest.mock("./question-types/question-factory", () => ({
  QuestionFactory: () => null,
}));

describe("DefaultScoring", () => {
  it("reports the submitted scores to onScoreSaved", async () => {
    mockResults.projects = {
      data: { id: "project-1", project_name: "Alpha" },
      error: null,
    };
    mockResults.event_tracks = {
      data: { name: "Track A", scoring_criteria: { criteria } },
      error: null,
    };
    mockResults.events = { data: { scoring_config: null }, error: null };
    mockResults.project_scores = {
      data: { id: "score-1", scores: { quality: 7 }, comments: "" },
      error: null,
    };
    const onScoreSaved = jest.fn();

    render(
      <DefaultScoring
        projectId="project-1"
        eventId="event-1"
        judgeId="judge-1"
        trackId="track-a"
        onScoreSaved={onScoreSaved}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Submit Evaluation" })
    );

    await waitFor(() => expect(onScoreSaved).toHaveBeenCalledTimes(1));
    expect(onScoreSaved).toHaveBeenCalledWith({ quality: 7 });
  });
});
