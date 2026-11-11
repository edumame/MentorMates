import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JudgingSidebar } from "./JudgingSidebar";
import type { EventScoringConfig } from "@/lib/types";

const parsedConfig: EventScoringConfig = {
  tracks: {
    parsed: {
      name: "Parsed Track",
      criteria: [{ id: "impact", name: "Impact", description: "" }],
    },
  },
  defaultMin: 1,
  defaultMax: 5,
  defaultWeight: 2,
};

const multiRoundConfig: EventScoringConfig = {
  tracks: { old: { name: "Old Track", criteria: [] } },
  defaultMin: 1,
  defaultMax: 10,
  defaultWeight: 1,
  rounds: [
    { round_number: 1, name: "Round 1", advancement_count: 5 },
    { round_number: 2, name: "Finals", advancement_count: null },
  ],
  activeRound: 2,
};

const parseResponse = {
  ok: true,
  json: async () => ({ success: true, config: parsedConfig }),
};

let currentConfig: EventScoringConfig;
let setParentConfig: React.Dispatch<React.SetStateAction<EventScoringConfig>>;

const EMPTY_CONFIG: EventScoringConfig = {
  tracks: {},
  defaultMin: 0,
  defaultMax: 10,
  defaultWeight: 1,
};

// Mirrors TracksTab: JudgingSidebar writes to the shared, non-null draft.
function Parent({ initial }: { initial: EventScoringConfig | null }) {
  const [config, setConfig] = useState<EventScoringConfig>(
    initial ?? EMPTY_CONFIG
  );
  currentConfig = config;
  setParentConfig = setConfig;
  return (
    <JudgingSidebar
      config={config}
      onConfigChange={setConfig}
      eventId="event-1"
    />
  );
}

function uploadRubric(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  fireEvent.change(input, {
    target: { files: [new File(["rubric"], "rubric.csv")] },
  });
}

describe("JudgingSidebar rubric upload", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    Element.prototype.scrollTo = jest.fn();
  });

  it("keeps rounds and activeRound while applying the parsed tracks", async () => {
    fetchMock.mockResolvedValue(parseResponse);
    const { container } = render(<Parent initial={multiRoundConfig} />);

    uploadRubric(container);
    await screen.findByText(/Parsed 1 track\(s\)/);

    // Parsed tracks are added to the draft (mergeParsedRubric), not swapped in.
    expect(currentConfig).toEqual({
      ...parsedConfig,
      tracks: { ...multiRoundConfig.tracks, ...parsedConfig.tracks },
      rounds: multiRoundConfig.rounds,
      activeRound: 2,
    });
  });

  it("keeps a round change saved while the file was still parsing", async () => {
    let resolveFetch: (value: typeof parseResponse) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { container } = render(<Parent initial={multiRoundConfig} />);

    uploadRubric(container);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    act(() => {
      setParentConfig((prev) => ({ ...prev, activeRound: 1 }));
    });
    await act(async () => {
      resolveFetch(parseResponse);
    });
    await screen.findByText(/Parsed 1 track\(s\)/);

    expect(currentConfig.activeRound).toBe(1);
    expect(currentConfig.tracks).toEqual({
      ...multiRoundConfig.tracks,
      ...parsedConfig.tracks,
    });
  });

  it("applies the parsed config when the event has no config yet", async () => {
    fetchMock.mockResolvedValue(parseResponse);
    const { container } = render(<Parent initial={null} />);

    uploadRubric(container);
    await screen.findByText(/Parsed 1 track\(s\)/);

    expect(currentConfig).toEqual(parsedConfig);
  });
});
