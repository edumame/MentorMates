import { randomUUID } from "node:crypto";
import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksTab } from "./TracksTab";
import type { EventDetails, EventScoringConfig } from "@/lib/types";

// jsdom's crypto has no randomUUID; the browser code under test relies on it.
Object.defineProperty(globalThis.crypto, "randomUUID", {
  value: randomUUID,
  configurable: true,
});

type Row = {
  track_id: string;
  event_id: string;
  name: string;
  scoring_criteria: {
    rounds?: Record<string, unknown>;
  };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory stand-in for event_tracks: it generates an id when the insert omits
// one, enforces the primary key, and (like PostgREST) reports no error when a
// delete matches zero rows.
let dbRows: Row[] = [];
let dbIdCounter = 0;
let denyDeletes = false;
const insertSpy = jest.fn();
const deleteSpy = jest.fn();

const eventTracksTable = () => ({
  select: () => ({
    eq: async () => ({ data: dbRows.map((row) => ({ ...row })), error: null }),
  }),
  upsert: async (rows: Row[]) => {
    rows.forEach((row) => {
      const index = dbRows.findIndex((r) => r.track_id === row.track_id);
      if (index >= 0) {
        dbRows[index] = row;
      } else {
        dbRows.push(row);
      }
    });
    return { error: null };
  },
  insert: async (rows: Array<Omit<Row, "track_id"> & { track_id?: string }>) => {
    insertSpy(rows);
    if (rows.some((row) => row.track_id && !UUID_RE.test(row.track_id))) {
      return { error: { message: "invalid input syntax for type uuid" } };
    }
    if (dbRows.some((r) => rows.some((row) => row.track_id === r.track_id))) {
      return { error: { message: "duplicate key value" } };
    }
    rows.forEach((row) => {
      dbIdCounter += 1;
      const generated = `00000000-0000-4000-8000-${String(dbIdCounter).padStart(12, "0")}`;
      dbRows.push({ ...row, track_id: row.track_id ?? generated });
    });
    return { error: null };
  },
  delete: () => ({
    eq: (_column: string, id: string) => {
      deleteSpy(id);
      const removed = denyDeletes
        ? []
        : dbRows.filter((row) => row.track_id === id);
      dbRows = dbRows.filter((row) => !removed.includes(row));
      const result = { data: removed, error: null };
      return {
        select: async () => result,
        then: (resolve: (value: { error: null }) => void) =>
          resolve({ error: null }),
      };
    },
  }),
});

jest.mock("@/lib/supabase", () => ({
  supabase: { from: () => eventTracksTable() },
}));

const formToast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: formToast }),
}));

jest.mock("./JudgePreviewDeck", () => ({ JudgePreviewDeck: () => null }));

// The real sidebar applies AI output through onConfigChange, so the stub does
// the same with the id shape the AI parse route is prompted to produce.
jest.mock("./JudgingSidebar", () => ({
  JudgingSidebar: ({
    config,
    onConfigChange,
  }: {
    config: EventScoringConfig;
    onConfigChange: (config: EventScoringConfig) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onConfigChange({
          ...config,
          tracks: {
            ...config.tracks,
            "track-1234": { name: "AI Track", criteria: [] },
          },
          rounds: [
            {
              round_number: 2,
              name: "Finals",
              tracks: { "track-1234": { name: "AI Track", criteria: [] } },
            },
          ],
        })
      }
    >
      Apply AI config
    </button>
  ),
}));

const emptyConfig: EventScoringConfig = {
  tracks: {},
  defaultMin: 0,
  defaultMax: 10,
  defaultWeight: 1,
};

function Harness() {
  const [event, setEvent] = useState<EventDetails | null>({
    id: "event-1",
  } as unknown as EventDetails);
  const [scoringConfig, setScoringConfig] =
    useState<EventScoringConfig | null>(emptyConfig);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <output data-testid="event-tracks">
        {(event?.event_tracks ?? []).map((track) => track.name).join(",")}
      </output>
      <output data-testid="parent-config-tracks">
        {Object.values(scoringConfig?.tracks ?? {})
          .map((track) => track.name)
          .join(",")}
      </output>
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
    </>
  );
}

const renderTab = async () => {
  render(<Harness />);
  await act(async () => {});
};

const save = async () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Save Scoring Configuration" })
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    ).toBeEnabled()
  );
  await act(async () => {});
};

const addNamedTrack = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: /Add new track/ }));
  fireEvent.change(screen.getByPlaceholderText("e.g., Best Overall"), {
    target: { value: name },
  });
};

const addNamedTrackAt = (index: number, name: string) => {
  fireEvent.click(screen.getByRole("button", { name: /Add new track/ }));
  fireEvent.change(screen.getAllByPlaceholderText("e.g., Best Overall")[index], {
    target: { value: name },
  });
};

const clickDeleteTrack = async (index = 0) => {
  fireEvent.click(screen.getAllByTitle("Delete")[index]);
  await act(async () => {});
};

const switchToPreviewAndBack = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  await act(async () => {});
};

describe("TracksTab track persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbRows = [];
    dbIdCounter = 0;
    denyDeletes = false;
  });

  it("updates a newly added track on a later save instead of inserting it again", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();

    fireEvent.change(screen.getByPlaceholderText("e.g., Best Overall"), {
      target: { value: "Best Hack" },
    });
    await save();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(dbRows.map((row) => row.name)).toEqual(["Best Hack"]);
  });

  it("does not re-insert a duplicated track on a later save", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();

    fireEvent.click(screen.getByTitle("Duplicate"));
    await save();
    await save();

    expect(dbRows.map((row) => row.name).sort()).toEqual([
      "Best Overall",
      "Best Overall (Copy)",
    ]);
  });

  it("deletes the stored row for a track added earlier in the session", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();

    await clickDeleteTrack();

    expect(dbRows).toEqual([]);
    expect(formToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Track deleted" })
    );
  });

  it("reports a failure and keeps the track when a saved track's delete removes no row", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();

    denyDeletes = true;
    await clickDeleteTrack();

    expect(formToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Failed to delete track" })
    );
    expect(screen.getByPlaceholderText("e.g., Best Overall")).toHaveValue(
      "Best Overall"
    );
    expect(screen.getByTestId("event-tracks")).toHaveTextContent("Best Overall");
    expect(screen.getByTestId("parent-config-tracks")).toHaveTextContent(
      "Best Overall"
    );
  });

  it("does not bring a deleted track back after switching to Preview and back", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();

    await clickDeleteTrack();
    await switchToPreviewAndBack();

    expect(screen.queryByDisplayValue("Best Overall")).not.toBeInTheDocument();
    expect(screen.queryAllByTitle("Delete")).toHaveLength(0);
    await save();
    expect(dbRows).toEqual([]);
    expect(
      formToast.mock.calls.filter(
        ([toast]) => toast.description === "Failed to delete track"
      )
    ).toEqual([]);
  });

  it("drops a deleted track from the event, parent config and bulk-assign list", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    await save();
    expect(screen.getByTestId("event-tracks")).toHaveTextContent("Best Overall");
    expect(
      screen.getByRole("button", { name: "Assign All Projects" })
    ).toBeInTheDocument();

    await clickDeleteTrack();

    expect(screen.getByTestId("event-tracks")).toBeEmptyDOMElement();
    expect(screen.getByTestId("parent-config-tracks")).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: "Assign All Projects" })
    ).not.toBeInTheDocument();
  });

  it("clears the bulk-assign choice when that track is deleted", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    addNamedTrackAt(1, "Best Design");
    await save();
    const [deletedRow] = dbRows;

    fireEvent.change(document.querySelector("select") as HTMLSelectElement, {
      target: { value: deletedRow.track_id },
    });
    await act(async () => {});
    const assign = screen.getByRole("button", { name: "Assign All Projects" });
    expect(assign).toBeEnabled();

    await clickDeleteTrack(0);

    expect(assign).toBeDisabled();
  });

  it("keeps unsaved edits to other tracks when a track is deleted", async () => {
    await renderTab();
    addNamedTrack("Best Overall");
    addNamedTrackAt(1, "Best Design");
    await save();

    fireEvent.change(screen.getByDisplayValue("Best Design"), {
      target: { value: "Best Design (edited)" },
    });
    addNamedTrackAt(2, "Unsaved Draft");
    await clickDeleteTrack(0);

    expect(screen.queryByDisplayValue("Best Overall")).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Best Design (edited)")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unsaved Draft")).toBeInTheDocument();

    await save();
    expect(dbRows.map((row) => row.name).sort()).toEqual([
      "Best Design (edited)",
      "Unsaved Draft",
    ]);
  });

  it("still applies an AI config after a delete", async () => {
    await renderTab();
    addNamedTrack("Draft Track");
    await clickDeleteTrack();

    fireEvent.click(screen.getByRole("button", { name: "Apply AI config" }));
    await act(async () => {});

    expect(screen.getByDisplayValue("AI Track")).toBeInTheDocument();
  });

  it("still removes a track that was never saved", async () => {
    await renderTab();
    addNamedTrack("Draft Track");

    await clickDeleteTrack();

    expect(formToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Track deleted" })
    );
    expect(screen.queryByDisplayValue("Draft Track")).not.toBeInTheDocument();
  });

  it("does not re-insert an AI-generated track whose id is not a UUID", async () => {
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Apply AI config" }));
    await act(async () => {});
    await save();
    await save();

    expect(dbRows).toHaveLength(1);
    expect(dbRows[0].track_id).toMatch(UUID_RE);
    expect(dbRows[0].scoring_criteria.rounds).toEqual(
      expect.objectContaining({ "2": expect.anything() })
    );
  });
});
