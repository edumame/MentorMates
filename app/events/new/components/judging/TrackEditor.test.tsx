import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackEditor } from "./TrackEditor";
import { INITIAL_WIZARD_EVENT, type WizardEventData } from "@/lib/types/wizard";

let latestEvent: WizardEventData;

function Harness() {
  const [event, setEvent] = useState<WizardEventData>({
    ...INITIAL_WIZARD_EVENT,
    tracks: [],
  });
  latestEvent = event;
  return <TrackEditor event={event} setEvent={setEvent} />;
}

describe("TrackEditor", () => {
  it("keeps the track open and focused while typing a multi-letter name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add new track/i }));
    const nameInput = screen.getByPlaceholderText("e.g., Best Overall");
    const originalClientId = latestEvent.tracks[0].client_id;

    await user.click(nameInput);
    await user.keyboard("Best AI Hack");

    const inputAfter = screen.getByPlaceholderText("e.g., Best Overall");
    expect(inputAfter).toHaveValue("Best AI Hack");
    expect(inputAfter).toBe(nameInput); // not remounted
    expect(inputAfter).toHaveFocus();
    expect(latestEvent.tracks[0].client_id).toBe(originalClientId);
  });

  it("keeps prize linkage intact when a track is renamed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add new track/i }));
    await user.click(screen.getByRole("button", { name: /add prize/i }));
    await user.type(screen.getByPlaceholderText("e.g., $2000"), "$500");
    await user.type(screen.getByPlaceholderText("e.g., Best Overall"), "Grand");

    const track = latestEvent.tracks[0];
    expect(track.name).toBe("Grand");
    expect(track.prizes).toHaveLength(1);
    expect(track.prizes[0].name).toBe("$500");
    expect(screen.getByPlaceholderText("e.g., $2000")).toHaveValue("$500");
  });
});
