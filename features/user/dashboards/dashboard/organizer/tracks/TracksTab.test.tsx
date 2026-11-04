import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksTab } from "./TracksTab";
import type {
  EventDetails,
  EventScoringConfig,
  EventTrack,
} from "@/lib/types";

const TRACK_A = "11111111-1111-4111-8111-111111111111";
const TRACK_B = "22222222-2222-4222-8222-222222222222";

const trackDelete = jest.fn();
const trackUpsert = jest.fn();
const trackInsert = jest.fn();
let dbTracks: Array<{ track_id: string; event_id: string; name: string }>;

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "project_scores") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 2, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: dbTracks, error: null }),
        }),
        delete: () => ({
          eq: (_column: string, id: string) => {
            trackDelete(id);
            dbTracks = dbTracks.filter((track) => track.track_id !== id);
            return Promise.resolve({ error: null });
          },
        }),
        upsert: (rows: unknown) => {
          trackUpsert(rows);
          return Promise.resolve({ error: null });
        },
        insert: (rows: unknown) => {
          trackInsert(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

jest.mock("./JudgePreviewDeck", () => ({
  JudgePreviewDeck: ({
    scoringConfig,
  }: {
    scoringConfig: EventScoringConfig | null;
  }) => (
    <div data-testid="preview">
      {Object.values(scoringConfig?.tracks ?? {})
        .map((track) => track.name)
        .join(",")}
    </div>
  ),
}));

jest.mock(
  "@/features/user/dashboards/dashboard/organizer/tracks/JudgingSidebar",
  () => ({
    JudgingSidebar: ({ config }: { config: EventScoringConfig }) => (
      <div data-testid="sidebar-tracks">
        {Object.values(config.tracks)
          .map((track) => track.name)
          .join(",")}
      </div>
    ),
  })
);

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bulk-option">{children}</div>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

const baseConfig: EventScoringConfig = {
  tracks: {
    [TRACK_A]: { name: "AI Track", criteria: [] },
    [TRACK_B]: { name: "Design Track", criteria: [] },
  },
  defaultMin: 0,
  defaultMax: 10,
  defaultWeight: 1,
};

let latestEvent: EventDetails | null;

function Harness() {
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(
    baseConfig
  );
  const [event, setEvent] = useState<EventDetails | null>({
    event_id: "event-1",
    event_tracks: dbTracks as unknown as EventTrack[],
  } as unknown as EventDetails);
  const [saving, setSaving] = useState(false);
  latestEvent = event;

  return (
    <TracksTab
      eventId="event-1"
      event={event as EventDetails}
      setEvent={setEvent}
      scoringConfig={scoringConfig}
      setScoringConfig={setScoringConfig}
      saving={saving}
      setSaving={setSaving}
      toast={jest.fn()}
      isArchived={false}
    />
  );
}

const bulkOptions = () =>
  screen.queryAllByTestId("bulk-option").map((option) => option.textContent);

async function deleteTrackAt(index: number) {
  fireEvent.click(screen.getAllByTitle("Delete")[index]);
  await screen.findByText(/2 judge scores/);
  fireEvent.click(screen.getByRole("button", { name: "Delete track" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Delete track" })
    ).not.toBeInTheDocument()
  );
}

describe("TracksTab track deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbTracks = [
      { track_id: TRACK_A, event_id: "event-1", name: "AI Track" },
      { track_id: TRACK_B, event_id: "event-1", name: "Design Track" },
    ];
  });

  async function renderAndDeleteFirstTrack() {
    render(<Harness />);
    await waitFor(() =>
      expect(bulkOptions()).toEqual(["AI Track", "Design Track"])
    );
    await deleteTrackAt(0);
    expect(trackDelete).toHaveBeenCalledWith(TRACK_A);
  }

  it("removes the deleted track from every list held by the parent", async () => {
    await renderAndDeleteFirstTrack();

    expect(bulkOptions()).toEqual(["Design Track"]);
    expect(screen.getByTestId("sidebar-tracks")).toHaveTextContent(
      /^Design Track$/
    );
    expect(
      latestEvent?.event_tracks?.map((track) => track.track_id)
    ).toEqual([TRACK_B]);
  });

  it("does not bring the track back after a Preview/Edit toggle", async () => {
    await renderAndDeleteFirstTrack();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTestId("preview")).toHaveTextContent(/^Design Track$/);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Design Track", { selector: "p" })).toBeInTheDocument();
    expect(
      screen.queryByText("AI Track", { selector: "p" })
    ).not.toBeInTheDocument();
  });

  it("does not re-create the track on the next Save", async () => {
    await renderAndDeleteFirstTrack();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    );

    await waitFor(() => expect(trackUpsert).toHaveBeenCalledTimes(1));
    expect(trackUpsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ track_id: TRACK_B }),
    ]);
    expect(trackInsert).not.toHaveBeenCalled();
  });

  it("keeps unsaved edits to other tracks when one track is deleted", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(bulkOptions()).toEqual(["AI Track", "Design Track"])
    );

    fireEvent.change(screen.getByDisplayValue("Design Track"), {
      target: { value: "Design Track (edited)" },
    });
    await deleteTrackAt(0);

    expect(screen.getByDisplayValue("Design Track (edited)")).toBeInTheDocument();
  });
});
