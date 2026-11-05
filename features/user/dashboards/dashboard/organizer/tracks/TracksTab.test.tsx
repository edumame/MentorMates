import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksTab } from "./TracksTab";
import type { EventDetails, EventScoringConfig } from "@/lib/types";

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

// The preview deck's Radix controls need ResizeObserver, which jsdom lacks.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// New tracks get their id from crypto.randomUUID, which jsdom also lacks.
let nextUuid = 0;
Object.defineProperty(globalThis.crypto, "randomUUID", {
  configurable: true,
  value: () => `uuid-${++nextUuid}`,
});

const savedConfig: EventScoringConfig = {
  tracks: {
    "track-1": {
      name: "AI Track",
      criteria: [
        {
          id: "impact",
          name: "Impact",
          description: "Base impact",
          type: "numeric",
          weight: 1,
          min: 1,
          max: 10,
          options: [],
        },
      ],
    },
  },
  defaultMin: 1,
  defaultMax: 10,
  defaultWeight: 1,
};

const tracksTab = (scoringConfig: EventScoringConfig | null) => (
  <TracksTab
    eventId="event-1"
    event={{ id: "event-1" } as unknown as EventDetails}
    setEvent={jest.fn()}
    scoringConfig={scoringConfig}
    setScoringConfig={jest.fn()}
    saving={false}
    setSaving={jest.fn()}
    toast={jest.fn()}
    isArchived={false}
  />
);

async function renderTracksTab(scoringConfig: EventScoringConfig | null) {
  const view = render(tracksTab(scoringConfig));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save Scoring Configuration" })
    ).toBeInTheDocument()
  );
  return view;
}

const clickMode = (name: "Edit" | "Preview") =>
  fireEvent.click(screen.getByRole("button", { name }));

const previewBanner = () => screen.queryByText("Preview mode");

function editCriterionName(from: string, to: string) {
  fireEvent.click(screen.getByText(from));
  fireEvent.change(screen.getByDisplayValue(from), { target: { value: to } });
}

describe("TracksTab Edit/Preview toggle", () => {
  it("previews unsaved edits instead of the last saved config", async () => {
    await renderTracksTab(savedConfig);

    fireEvent.change(screen.getByDisplayValue("AI Track"), {
      target: { value: "Robotics Track" },
    });
    editCriterionName("Impact", "Final Demo");
    clickMode("Preview");

    expect(previewBanner()).toBeInTheDocument();
    expect(screen.getAllByText(/Robotics Track/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Final Demo/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AI Track/)).not.toBeInTheDocument();
  });

  it("keeps unsaved edits when returning to Edit", async () => {
    await renderTracksTab(savedConfig);

    fireEvent.change(screen.getByDisplayValue("AI Track"), {
      target: { value: "Robotics Track" },
    });
    editCriterionName("Impact", "Final Demo");
    clickMode("Preview");
    clickMode("Edit");

    expect(previewBanner()).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Robotics Track")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Final Demo")).toBeInTheDocument();
  });

  it("keeps unsaved edits across repeated toggles and further edits", async () => {
    await renderTracksTab(savedConfig);

    fireEvent.change(screen.getByDisplayValue("AI Track"), {
      target: { value: "First Edit" },
    });
    clickMode("Preview");
    clickMode("Edit");
    fireEvent.change(screen.getByDisplayValue("First Edit"), {
      target: { value: "Second Edit" },
    });
    clickMode("Preview");

    expect(screen.getAllByText(/Second Edit/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/First Edit/)).not.toBeInTheDocument();
  });

  it("previews a track that was added but never saved", async () => {
    await renderTracksTab(null);

    fireEvent.click(screen.getByRole("button", { name: "New from template" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Best AI Project"), {
      target: { value: "Brand New Track" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create track" }));
    clickMode("Preview");

    expect(screen.queryByText("No tracks configured")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Brand New Track/).length).toBeGreaterThan(0);
  });

  it("previews config applied from outside the form", async () => {
    const { rerender } = await renderTracksTab(savedConfig);

    rerender(
      tracksTab({
        ...savedConfig,
        tracks: {
          "track-1": { ...savedConfig.tracks["track-1"], name: "AI Applied" },
        },
      })
    );
    clickMode("Preview");

    expect(screen.getAllByText(/AI Applied/).length).toBeGreaterThan(0);
  });

  it("hides the editor while previewing and shows it again on Edit", async () => {
    await renderTracksTab(savedConfig);
    const save = screen.getByRole("button", {
      name: "Save Scoring Configuration",
    });
    expect(save.closest(".hidden")).toBeNull();

    clickMode("Preview");
    expect(save.closest(".hidden")).not.toBeNull();

    clickMode("Edit");
    expect(save.closest(".hidden")).toBeNull();
  });
});
