import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventScoringConfig } from "@/lib/types";
import { RoundsEditor } from "./rounds-editor";

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/components/events/round-scoring-config-dialog", () => ({
  RoundScoringConfigDialog: () => null,
}));

const scoringConfig = {
  tracks: {},
  defaultMin: 1,
  defaultMax: 10,
  defaultWeight: 1,
  rounds: [
    { round_number: 1, name: "Round 1", advancement_count: null },
    { round_number: 2, name: "Round 2", advancement_count: null },
  ],
  activeRound: 2,
} as EventScoringConfig;

function mockAdvanceApi(saveResponse: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? { ok: saveResponse.ok, json: async () => saveResponse.body }
      : {
          ok: true,
          json: async () => ({ candidates: [], selectedProjectIds: [] }),
        }
  ) as unknown as typeof fetch;
}

async function saveSelection(onAdvancementsSaved: () => void) {
  render(
    <RoundsEditor
      eventId="event-1"
      scoringConfig={scoringConfig}
      onAdvancementsSaved={onAdvancementsSaved}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: /pick round 2 projects/i })
  );
  const save = await screen.findByRole("button", {
    name: "Save advancement selection",
  });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
}

describe("RoundsEditor advancement save", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports a saved selection", async () => {
    mockAdvanceApi({ ok: true, body: { advancedCount: 0, toRound: 2 } });
    const onAdvancementsSaved = jest.fn();

    await saveSelection(onAdvancementsSaved);

    await waitFor(() => expect(onAdvancementsSaved).toHaveBeenCalledTimes(1));
  });

  it("does not report a selection the server rejected", async () => {
    jest.spyOn(console, "error").mockImplementation();
    mockAdvanceApi({ ok: false, body: { error: "Nope" } });
    const onAdvancementsSaved = jest.fn();

    await saveSelection(onAdvancementsSaved);

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(onAdvancementsSaved).not.toHaveBeenCalled();
  });
});
