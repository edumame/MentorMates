import { fireEvent, render, screen } from "@testing-library/react";
import { PrizesTab } from "./PrizesTab";

const prize = {
  id: "prize-1",
  track_id: "track-1",
  prize_amount: "100",
  prize_description: "First place",
};

it("still renders a winner whose project the organizer can no longer read", async () => {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.startsWith("/api/prizes")
        ? {
            prizes: [
              {
                ...prize,
                prize_winners: [
                  {
                    id: "winner-1",
                    project_id: "project-1",
                    assigned_at: "2026-01-01T00:00:00.000Z",
                    assigned_by: "organizer",
                    projects: null,
                  },
                ],
              },
            ],
          }
        : { projects: [] },
  })) as unknown as typeof fetch;

  render(
    <PrizesTab
      event={
        {
          event_id: "event-1",
          event_tracks: [{ track_id: "track-1", name: "Main", prizes: [prize] }],
        } as never
      }
      setEvent={jest.fn()}
      saving={false}
      setSaving={jest.fn()}
      toast={jest.fn()}
      isArchived={false}
    />,
  );

  await screen.findByText("1 winner");
  fireEvent.click(screen.getByRole("button", { name: /Main/ }));

  expect(await screen.findByText(/Project unavailable/)).toBeInTheDocument();
});
