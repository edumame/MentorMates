import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksTab } from "./TracksTab";
import type {
  EventDetails,
  EventScoringConfig,
  EventTrack,
} from "@/lib/types";

const TRACK_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const NEW_TRACK_ID = "track-0-1771372800000";
const EVENT_ID = "evt-test-123";

const dbTrack = {
  track_id: TRACK_ID,
  event_id: EVENT_ID,
  name: "Best Overall",
  description: "Original text",
  scoring_criteria: { name: "Best Overall", criteria: [] },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as EventTrack;

const upsert = jest.fn();
const insert = jest.fn();
const eq = jest.fn();
const from = jest.fn();

let configToSave: EventScoringConfig;

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

jest.mock(
  "@/features/user/dashboards/dashboard/organizer/tracks/CompactScoringForm",
  () => ({
    CompactScoringForm: ({
      tracks,
      onSave,
    }: {
      tracks: EventTrack[];
      onSave: (config: EventScoringConfig) => void;
    }) => (
      <button
        type="button"
        disabled={tracks.length === 0}
        onClick={() => onSave(configToSave)}
      >
        Save Scoring Configuration
      </button>
    ),
  }),
);

jest.mock(
  "@/features/user/dashboards/dashboard/organizer/tracks/JudgingSidebar",
  () => ({ JudgingSidebar: () => null }),
);

jest.mock("./JudgePreviewDeck", () => ({ JudgePreviewDeck: () => null }));

function makeConfig(
  tracks: EventScoringConfig["tracks"],
): EventScoringConfig {
  return { tracks, defaultMin: 0, defaultMax: 10, defaultWeight: 1 };
}

async function saveScoringConfig() {
  const toast = jest.fn();
  render(
    <TracksTab
      eventId={EVENT_ID}
      event={{ event_tracks: [dbTrack] } as unknown as EventDetails}
      setEvent={jest.fn()}
      scoringConfig={configToSave}
      setScoringConfig={jest.fn()}
      saving={false}
      setSaving={jest.fn()}
      toast={toast}
      isArchived={false}
    />,
  );

  const saveButton = screen.getByRole("button", {
    name: "Save Scoring Configuration",
  });
  await waitFor(() => expect(saveButton).toBeEnabled());
  fireEvent.click(saveButton);
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Success" }),
    ),
  );
}

describe("TracksTab scoring save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eq.mockResolvedValue({ data: [dbTrack], error: null });
    upsert.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
    from.mockReturnValue({
      select: () => ({ eq }),
      upsert,
      insert,
    });
  });

  it("does not write a description for tracks already in the database", async () => {
    configToSave = makeConfig({
      [TRACK_ID]: { name: "Best Overall", criteria: [] },
    });

    await saveScoringConfig();

    expect(upsert).toHaveBeenCalledTimes(1);
    const [rows] = upsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      track_id: TRACK_ID,
      event_id: EVENT_ID,
      name: "Best Overall",
    });
    expect(rows[0]).not.toHaveProperty("description");
    expect(insert).not.toHaveBeenCalled();
  });

  it("still saves a renamed track without touching its description", async () => {
    configToSave = makeConfig({
      [TRACK_ID]: { name: "Grand Prize", criteria: [] },
    });

    await saveScoringConfig();

    const [rows] = upsert.mock.calls[0];
    expect(rows[0].name).toBe("Grand Prize");
    expect(rows[0]).not.toHaveProperty("description");
  });

  it("defaults the description to the name for genuinely new tracks", async () => {
    configToSave = makeConfig({
      [TRACK_ID]: { name: "Best Overall", criteria: [] },
      [NEW_TRACK_ID]: { name: "Best Design", criteria: [] },
    });

    await saveScoringConfig();

    const [newRows] = insert.mock.calls[0];
    expect(newRows).toHaveLength(1);
    expect(newRows[0]).toMatchObject({
      event_id: EVENT_ID,
      name: "Best Design",
      description: "Best Design",
    });
    expect(newRows[0]).not.toHaveProperty("track_id");
    expect(upsert.mock.calls[0][0][0]).not.toHaveProperty("description");
  });
});
