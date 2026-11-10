import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DefaultScoring } from "@/components/project-scoring/default-scoring";
import { supabase } from "@/lib/supabase";
import type { EventScoringConfig } from "@/lib/types";

const mockToast = jest.fn();

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("./question-types/question-factory", () => ({ QuestionFactory: () => null }));

type QueryResult = { data: unknown; error: unknown };
type Write = { kind: "insert" | "update" | "delete"; payload?: Record<string, unknown> };

const criteria = [{ id: "c1", name: "Impact", weight: 1, min: 1, max: 10 }];
const roundOneConfig: EventScoringConfig = { tracks: {}, activeRound: 1 };

let eventsResult: QueryResult;
let existingScore: Record<string, unknown> | null;
let writes: Write[];
let scoreLookups: Array<Record<string, unknown>>;
let eventReads: number;

// A chainable stand-in for the PostgREST builder, resolved per table.
function queryFor(table: string) {
  const filters: Record<string, unknown> = {};
  let write: Write | null = null;

  const resolve = (): QueryResult => {
    if (write) {
      writes.push(write);
      return { data: null, error: null };
    }
    switch (table) {
      case "projects":
        return { data: { id: "p1", project_name: "Project" }, error: null };
      case "event_tracks":
        return { data: { name: "Track", scoring_criteria: { name: "Track", criteria } }, error: null };
      case "events":
        eventReads += 1;
        return eventsResult;
      case "project_scores":
        scoreLookups.push({ ...filters });
        return { data: existingScore, error: null };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  };

  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return query;
    },
    insert: (payload: Record<string, unknown>) => {
      write = { kind: "insert", payload };
      return query;
    },
    update: (payload: Record<string, unknown>) => {
      write = { kind: "update", payload };
      return query;
    },
    delete: () => {
      write = { kind: "delete" };
      return query;
    },
    single: async () => resolve(),
    maybeSingle: async () => resolve(),
    then: (onFulfilled: (result: QueryResult) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled),
  };
  return query;
}

const baseProps = { projectId: "p1", eventId: "e1", judgeId: "j1", trackId: "t1" };
const dashboardProps = { ...baseProps, roundNumber: 1, scoringConfig: roundOneConfig };

const submit = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Submit Evaluation" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalled());
};

const toastTitles = () => mockToast.mock.calls.map(([arg]) => arg.title);

describe("DefaultScoring round freshness", () => {
  beforeEach(() => {
    mockToast.mockReset();
    (supabase.from as jest.Mock).mockReset().mockImplementation(queryFor);
    eventsResult = { data: { scoring_config: roundOneConfig }, error: null };
    existingScore = null;
    writes = [];
    scoreLookups = [];
    eventReads = 0;
  });

  it("saves to the round on screen while it is still the active round", async () => {
    const onScoreSaved = jest.fn();
    render(<DefaultScoring {...dashboardProps} onScoreSaved={onScoreSaved} />);

    await submit();

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kind: "insert", payload: { round_number: 1 } });
    expect(onScoreSaved).toHaveBeenCalledTimes(1);
    expect(toastTitles()).toEqual(["Score submitted"]);
  });

  it("refuses to save and asks for a reload when the round moved on after the tab loaded", async () => {
    const onScoreSaved = jest.fn();
    const onRoundChanged = jest.fn();
    eventsResult = { data: { scoring_config: { activeRound: 2 } }, error: null };
    render(
      <DefaultScoring
        {...dashboardProps}
        onScoreSaved={onScoreSaved}
        onRoundChanged={onRoundChanged}
      />
    );

    await submit();

    expect(writes).toEqual([]);
    expect(onScoreSaved).not.toHaveBeenCalled();
    expect(onRoundChanged).toHaveBeenCalledTimes(1);
    expect(toastTitles()).toEqual(["Judging round changed"]);
  });

  it("does not overwrite an existing score from the old round", async () => {
    existingScore = { id: "s1", scores: { c1: 5 }, comments: "", finalist_recommendation: false };
    eventsResult = { data: { scoring_config: { activeRound: 2 } }, error: null };
    render(<DefaultScoring {...dashboardProps} onRoundChanged={jest.fn()} />);

    await submit();

    expect(writes).toEqual([]);
    expect(toastTitles()).toEqual(["Judging round changed"]);
  });

  it("treats a round moved back by the organizer as a change too", async () => {
    const onRoundChanged = jest.fn();
    eventsResult = { data: { scoring_config: { activeRound: 1 } }, error: null };
    render(
      <DefaultScoring
        {...baseProps}
        roundNumber={2}
        scoringConfig={{ tracks: {}, activeRound: 2 }}
        onRoundChanged={onRoundChanged}
      />
    );

    await submit();

    expect(writes).toEqual([]);
    expect(onRoundChanged).toHaveBeenCalledTimes(1);
  });

  it("reloads itself on the new round when no parent owns the round (public project page)", async () => {
    render(<DefaultScoring {...baseProps} />);
    await screen.findByRole("button", { name: "Submit Evaluation" });
    expect(scoreLookups.at(-1)).toMatchObject({ round_number: 1 });

    eventsResult = { data: { scoring_config: { activeRound: 2 } }, error: null };
    await submit();

    expect(writes).toEqual([]);
    expect(toastTitles()).toEqual(["Judging round changed"]);
    await waitFor(() => expect(scoreLookups.at(-1)).toMatchObject({ round_number: 2 }));

    // The next attempt is on the current round, so it goes through.
    mockToast.mockClear();
    await submit();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kind: "insert", payload: { round_number: 2 } });
  });

  it("does not save when the active round cannot be confirmed", async () => {
    const onScoreSaved = jest.fn();
    render(<DefaultScoring {...dashboardProps} onScoreSaved={onScoreSaved} />);
    await screen.findByRole("button", { name: "Submit Evaluation" });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    eventsResult = { data: null, error: new Error("network down") };

    await submit();

    expect(writes).toEqual([]);
    expect(onScoreSaved).not.toHaveBeenCalled();
    expect(toastTitles()).toEqual(["Error"]);
    consoleError.mockRestore();
  });

  it("does not delete a score from a round that is no longer active", async () => {
    const onScoreDeleted = jest.fn();
    const onRoundChanged = jest.fn();
    existingScore = { id: "s1", scores: { c1: 5 }, comments: "", finalist_recommendation: false };
    eventsResult = { data: { scoring_config: { activeRound: 2 } }, error: null };
    render(
      <DefaultScoring
        {...dashboardProps}
        onScoreDeleted={onScoreDeleted}
        onRoundChanged={onRoundChanged}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "Delete Evaluation" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === "Delete Evaluation"
      ) as HTMLButtonElement
    );
    await waitFor(() => expect(mockToast).toHaveBeenCalled());

    expect(writes).toEqual([]);
    expect(onScoreDeleted).not.toHaveBeenCalled();
    expect(onRoundChanged).toHaveBeenCalledTimes(1);
    expect(eventReads).toBe(1);
  });
});
