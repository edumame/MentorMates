import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "@/lib/hooks/use-toast";
import {
  fetchEventTracks,
  fetchProjectTracks,
  updateProjectTracks,
} from "@/features/projects/client-actions/client-track-update";
import { TrackSelector } from "./TrackSelector";

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  fetchEventTracks: jest.fn(),
  fetchProjectTracks: jest.fn(),
  updateProjectTracks: jest.fn(),
}));

const health = { track_id: "track-health", event_id: "event-1", name: "Health" };
const climate = { track_id: "track-climate", event_id: "event-1", name: "Climate" };

async function openEditor() {
  render(<TrackSelector projectId="project-1" eventId="event-1" canEdit />);
  await screen.findByText("Health");
  // The pencil button in the card header opens the editor.
  fireEvent.click(screen.getAllByRole("button")[0]);
  await screen.findByText("Edit Project Tracks");
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchEventTracks as jest.Mock).mockResolvedValue({ data: [health, climate], error: null });
  (fetchProjectTracks as jest.Mock).mockResolvedValue({ data: [health], error: null });
});

describe("TrackSelector", () => {
  it("saves the selection through the API helper and reloads the saved tracks", async () => {
    (updateProjectTracks as jest.Mock).mockResolvedValue({ success: true, error: null });
    await openEditor();

    fireEvent.click(screen.getByLabelText("Climate"));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() =>
      expect(updateProjectTracks).toHaveBeenCalledWith("project-1", ["track-health", "track-climate"])
    );
    await waitFor(() => expect(fetchProjectTracks).toHaveBeenCalledTimes(2));
  });

  it("shows the server's reason and stays in the editor when saving fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (updateProjectTracks as jest.Mock).mockResolvedValue({
      success: false,
      error: new Error("The submission deadline has passed"),
    });
    await openEditor();

    fireEvent.click(screen.getByLabelText("Climate"));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: "Error",
        description: "The submission deadline has passed",
        variant: "destructive",
      })
    );
    expect(screen.getByText("Edit Project Tracks")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
