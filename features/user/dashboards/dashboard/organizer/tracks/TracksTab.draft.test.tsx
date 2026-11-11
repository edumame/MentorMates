import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksTab } from "./TracksTab";
import type { EventDetails, EventScoringConfig } from "@/lib/types";

const from = jest.fn();
const upsert = jest.fn();
const insert = jest.fn();
const deleteEq = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => from(...args),
  },
}));

const TRACK_A = "11111111-1111-4111-8111-111111111111";
const TRACK_B = "22222222-2222-4222-8222-222222222222";

const criterion = (id: string, name: string) => ({
  id,
  name,
  description: "",
  type: "numeric" as const,
  weight: 1,
  min: 1,
  max: 10,
});

const savedConfig: EventScoringConfig = {
  tracks: {
    [TRACK_A]: { name: "AI Track", criteria: [criterion("impact", "Impact")] },
    [TRACK_B]: { name: "Web Track", criteria: [criterion("design", "Design")] },
  },
  defaultMin: 1,
  defaultMax: 10,
  defaultWeight: 1,
  rounds: [{ round_number: 1, name: "Qualifiers" }],
  activeRound: 1,
};

let latestSavedConfig: EventScoringConfig | null = null;

function Harness() {
  const [scoringConfig, setScoringConfig] =
    useState<EventScoringConfig | null>(savedConfig);
  const [saving, setSaving] = useState(false);
  latestSavedConfig = scoringConfig;

  return (
    <TracksTab
      eventId="event-1"
      event={{ event_id: "event-1" } as unknown as EventDetails}
      setEvent={jest.fn()}
      scoringConfig={scoringConfig}
      setScoringConfig={setScoringConfig}
      saving={saving}
      setSaving={setSaving}
      toast={jest.fn()}
      isArchived={false}
    />
  );
}

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

const renameImpactCriterion = (name: string) => {
  fireEvent.click(screen.getByText("Impact"));
  fireEvent.change(screen.getByDisplayValue("Impact"), {
    target: { value: name },
  });
};

const sendChat = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText("Ask me to set up tracks..."), {
    target: { value: text },
  });
  fireEvent.submit(screen.getByPlaceholderText("Ask me to set up tracks..."));
};

const lastChatConfig = () => {
  const [, init] = (global.fetch as jest.Mock).mock.calls.at(-1);
  return JSON.parse(init.body).event.scoring_config as EventScoringConfig;
};

// Deleting goes through the confirmation dialog (ORG-021 / JUDGE-005). The
// mocked impact counts are zero, so no typed name is needed.
const deleteTrack = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: `Delete track ${name}` }));
  await screen.findByRole("alertdialog");
  const confirm = screen.getByRole("button", { name: "Delete track" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
};

describe("TracksTab draft handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
    // The form checks that a saved track's row was really deleted (#895).
    deleteEq.mockImplementation((_column: string, trackId: string) => ({
      eq: () => ({
        select: async () => ({ data: [{ track_id: trackId }], error: null }),
      }),
    }));
    from.mockImplementation(() => ({
      select: () => ({
        eq: async () => ({
          data: [
            { track_id: TRACK_A, name: "AI Track" },
            { track_id: TRACK_B, name: "Web Track" },
          ],
          error: null,
        }),
      }),
      delete: () => ({ eq: deleteEq }),
      upsert,
      insert,
    }));
    global.fetch = jest.fn();
    Element.prototype.scrollTo = jest.fn();
  });

  const renderLoaded = async () => {
    render(<Harness />);
    await screen.findByText(/Bulk Assign All Projects/);
  };

  it("sends the unsaved draft to the assistant and keeps it when a patch arrives", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (_url, init) => {
      const sent = JSON.parse(init.body).event.scoring_config;
      return jsonResponse({
        reply: "Added a track.",
        patch: {
          tracks: {
            ...sent.tracks,
            new_track_1: { name: "Design Track", criteria: [] },
          },
        },
      });
    });
    await renderLoaded();

    renameImpactCriterion("Real World Impact");
    sendChat("Add a design track");

    expect(await screen.findByDisplayValue("Design Track")).toBeInTheDocument();
    expect(
      lastChatConfig().tracks[TRACK_A].criteria[0].name
    ).toBe("Real World Impact");
    expect(screen.getByDisplayValue("Real World Impact")).toBeInTheDocument();
  });

  it("keeps edits made while the assistant request is in flight", async () => {
    let respond: (value: unknown) => void = () => undefined;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        respond = resolve;
      })
    );
    await renderLoaded();

    sendChat("Rename the web track");
    renameImpactCriterion("Edited While Waiting");

    await act(async () => {
      respond(
        jsonResponse({
          reply: "Renamed.",
          patch: {
            tracks: {
              [TRACK_A]: savedConfig.tracks[TRACK_A],
              [TRACK_B]: { ...savedConfig.tracks[TRACK_B], name: "Frontend Track" },
            },
          },
        })
      );
    });

    expect(await screen.findByDisplayValue("Frontend Track")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Edited While Waiting")).toBeInTheDocument();
  });

  it("keeps the draft when a rubric is uploaded", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        success: true,
        config: {
          tracks: {
            "33333333-3333-4333-8333-333333333333": {
              name: "Rubric Track",
              criteria: [],
            },
          },
          defaultMin: 1,
          defaultMax: 5,
          defaultWeight: 1,
        },
      })
    );
    const { container } = render(<Harness />);
    await screen.findByText(/Bulk Assign All Projects/);

    renameImpactCriterion("Real World Impact");
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(["rubric"], "rubric.txt", { type: "text/plain" })],
        },
      }
    );

    expect(await screen.findByDisplayValue("Rubric Track")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Real World Impact")).toBeInTheDocument();
  });

  it("does not resurrect a deleted track from an assistant patch or on save", async () => {
    let respond: (value: unknown) => void = () => undefined;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        respond = resolve;
      })
    );
    await renderLoaded();

    sendChat("Set all weights to equal");
    await deleteTrack("Web Track");
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Web Track")).not.toBeInTheDocument()
    );

    await act(async () => {
      respond(
        jsonResponse({
          reply: "Done.",
          patch: { tracks: savedConfig.tracks },
        })
      );
    });
    await screen.findByText("Done.");

    expect(screen.queryByDisplayValue("Web Track")).not.toBeInTheDocument();
    expect(latestSavedConfig?.tracks[TRACK_B]).toBeUndefined();

    fireEvent.click(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    );
    await waitFor(() => expect(upsert).toHaveBeenCalled());

    const upserted = upsert.mock.calls[0][0] as { track_id: string }[];
    expect(upserted.map((row) => row.track_id)).toEqual([TRACK_A]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not send a deleted track to the assistant", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ reply: "Noted." })
    );
    await renderLoaded();

    await deleteTrack("Web Track");
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Web Track")).not.toBeInTheDocument()
    );
    sendChat("What tracks do I have?");
    await screen.findByText("Noted.");

    expect(lastChatConfig().tracks[TRACK_B]).toBeUndefined();
  });
});
