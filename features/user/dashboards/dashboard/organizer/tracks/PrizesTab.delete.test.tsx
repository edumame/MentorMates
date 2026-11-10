import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PrizesTab } from "./PrizesTab";
import type { EventDetails } from "@/lib/types";

const PRIZE_ID = "prize-1";

const winner = {
  id: "winner-1",
  project_id: "project-1",
  assigned_at: "2026-01-01T00:00:00.000Z",
  assigned_by: "user-1",
  projects: { id: "project-1", project_name: "Solar Scout", lead_name: "Ada" },
};

const buildEvent = (prizeId = PRIZE_ID) =>
  ({
    event_id: "event-1",
    event_tracks: [
      {
        track_id: "track-1",
        name: "Main Track",
        prizes: [
          {
            id: prizeId,
            track_id: "track-1",
            prize_amount: "$500",
            prize_description: "Grand prize",
          },
        ],
      },
    ],
  }) as unknown as EventDetails;

type MockResponse = { ok: boolean; status: number; body: unknown };

const json = ({ ok, status, body }: MockResponse) => ({
  ok,
  status,
  json: async () => body,
});

function mockFetch({
  listedPrizes,
  deleteResponse = { ok: true, status: 200, body: { success: true } },
}: {
  listedPrizes: () => unknown[];
  deleteResponse?: MockResponse;
}) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return json(deleteResponse);
    if (url.startsWith("/api/projects")) {
      return json({ ok: true, status: 200, body: { projects: [] } });
    }
    return json({ ok: true, status: 200, body: { prizes: listedPrizes() } });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const deleteCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");

const toast = jest.fn();
const setEvent = jest.fn();

async function renderTab(event = buildEvent()) {
  render(
    <PrizesTab
      event={event}
      setEvent={setEvent}
      saving={false}
      setSaving={jest.fn()}
      toast={toast}
      isArchived={false}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: /Main Track/ }));
  return screen.findByRole("button", { name: "Delete prize" });
}

describe("PrizesTab prize deletion", () => {
  beforeEach(() => {
    toast.mockClear();
    setEvent.mockClear();
  });

  it("names the winners and sends nothing until the organizer confirms", async () => {
    const fetchMock = mockFetch({
      listedPrizes: () => [
        { id: PRIZE_ID, track_id: "track-1", prize_winners: [winner] },
      ],
    });
    await renderTab();
    await screen.findByText(/Solar Scout/);

    fireEvent.click(screen.getByRole("button", { name: "Delete prize" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Solar Scout/)).toBeInTheDocument();
    expect(deleteCalls(fetchMock)).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => expect(deleteCalls(fetchMock)).toHaveLength(1));
    expect(deleteCalls(fetchMock)[0][0]).toBe(
      `/api/prizes?prizeId=${PRIZE_ID}&force=true`
    );
    await waitFor(() => expect(setEvent).toHaveBeenCalledTimes(1));
  });

  it("deletes nothing when the organizer cancels", async () => {
    const fetchMock = mockFetch({
      listedPrizes: () => [
        { id: PRIZE_ID, track_id: "track-1", prize_winners: [winner] },
      ],
    });
    await renderTab();
    await screen.findByText(/Solar Scout/);

    fireEvent.click(screen.getByRole("button", { name: "Delete prize" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(setEvent).not.toHaveBeenCalled();
  });

  it("confirms a saved prize with no winners without overriding the server check", async () => {
    const fetchMock = mockFetch({
      listedPrizes: () => [
        { id: PRIZE_ID, track_id: "track-1", prize_winners: [] },
      ],
    });
    const trash = await renderTab();

    fireEvent.click(trash);
    const dialog = await screen.findByRole("alertdialog");
    expect(deleteCalls(fetchMock)).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => expect(deleteCalls(fetchMock)).toHaveLength(1));
    expect(deleteCalls(fetchMock)[0][0]).toBe(`/api/prizes?prizeId=${PRIZE_ID}`);
  });

  it("shows winners the tab did not know about when the server refuses the delete", async () => {
    let prizes: unknown[] = [
      { id: PRIZE_ID, track_id: "track-1", prize_winners: [] },
    ];
    const listedPrizes = jest.fn(() => prizes);
    const fetchMock = mockFetch({
      listedPrizes,
      deleteResponse: {
        ok: false,
        status: 409,
        body: { error: "This prize has winners." },
      },
    });
    const trash = await renderTab();
    await waitFor(() => expect(listedPrizes).toHaveBeenCalledTimes(1));

    prizes = [{ id: PRIZE_ID, track_id: "track-1", prize_winners: [winner] }];
    fireEvent.click(trash);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => expect(deleteCalls(fetchMock)).toHaveLength(1));
    expect(deleteCalls(fetchMock)[0][0]).toBe(`/api/prizes?prizeId=${PRIZE_ID}`);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This prize has winners.",
          variant: "destructive",
        })
      )
    );
    expect(await screen.findByText(/Solar Scout/)).toBeInTheDocument();
    expect(setEvent).not.toHaveBeenCalled();
  });

  it("removes an unsaved prize immediately because nothing is stored yet", async () => {
    const fetchMock = mockFetch({ listedPrizes: () => [] });
    const trash = await renderTab(buildEvent("local-1"));

    fireEvent.click(trash);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(setEvent).toHaveBeenCalledTimes(1);
  });
});
