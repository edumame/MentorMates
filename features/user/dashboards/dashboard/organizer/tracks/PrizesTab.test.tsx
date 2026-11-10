import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PrizesTab } from "./PrizesTab";
import type { EventDetails } from "@/lib/types";

// Radix accordion content is unmounted until opened; render it inline.
jest.mock("@/components/ui/accordion", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Accordion: Passthrough,
    AccordionContent: Passthrough,
    AccordionItem: Passthrough,
    AccordionTrigger: Passthrough,
  };
});

jest.mock("@/components/ui/select", () => {
  const Nothing = () => null;
  return {
    Select: Nothing,
    SelectContent: Nothing,
    SelectItem: Nothing,
    SelectTrigger: Nothing,
    SelectValue: Nothing,
  };
});

const PRIZE_ID = "prize-1";
const TRACK_ID = "track-1";

const winner = (projectId: string, projectName: string) => ({
  id: `winner-${projectId}`,
  project_id: projectId,
  assigned_at: "2026-01-01T00:00:00.000Z",
  assigned_by: "organizer-1",
  projects: { id: projectId, project_name: projectName, lead_name: "Lead" },
});

const event = {
  event_id: "event-1",
  event_tracks: [
    {
      track_id: TRACK_ID,
      name: "Main",
      prizes: [
        { id: PRIZE_ID, track_id: TRACK_ID, prize_amount: "100" },
      ],
    },
  ],
} as unknown as EventDetails;

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as Response;

describe("PrizesTab remove winner", () => {
  const toast = jest.fn();
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  const mockApi = (removeResponse: Response) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/projects")) {
        return jsonResponse({ projects: [] });
      }
      if (url.startsWith("/api/prizes/assign")) {
        return removeResponse;
      }
      return jsonResponse({
        prizes: [
          {
            id: PRIZE_ID,
            prize_winners: [
              winner("project/1", "Alpha"),
              winner("project-2", "Beta"),
            ],
          },
        ],
      });
    });
  };

  const renderTab = () =>
    render(
      <PrizesTab
        event={event}
        setEvent={jest.fn()}
        saving={false}
        setSaving={jest.fn()}
        toast={toast}
        isArchived={false}
      />
    );

  const clickRemove = (projectName: RegExp) => {
    const row = screen.getByText(projectName).parentElement!.parentElement!;
    fireEvent.click(within(row).getByTitle("Remove winner"));
  };

  const assignCalls = () =>
    fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("/api/prizes/assign")
    );

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("removes only the clicked winner through the scoped DELETE endpoint", async () => {
    mockApi(jsonResponse({ success: true }));
    renderTab();
    await screen.findByText(/Alpha/);

    clickRemove(/Alpha/);

    await waitFor(() => expect(screen.queryByText(/Alpha/)).toBeNull());
    expect(screen.getByText(/Beta/)).toBeTruthy();

    expect(assignCalls()).toHaveLength(1);
    const [url, init] = assignCalls()[0];
    expect(init).toEqual({ method: "DELETE" });
    const params = new URL(url, "http://localhost").searchParams;
    expect(params.get("prizeId")).toBe(PRIZE_ID);
    expect(params.get("projectId")).toBe("project/1");
  });

  it("keeps the winner on screen and reports the error when removal fails", async () => {
    mockApi(jsonResponse({ error: "Failed to remove winner" }, false));
    renderTab();
    await screen.findByText(/Alpha/);

    clickRemove(/Alpha/);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to remove winner",
          variant: "destructive",
        })
      )
    );
    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.getByText(/Beta/)).toBeTruthy();
  });
});
