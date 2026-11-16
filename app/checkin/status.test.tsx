import { render, screen } from "@testing-library/react";
import { CheckinStatus } from "./status";

const TOKEN = "signed-checkin-token";

describe("CheckinStatus", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(status: number, body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("posts the signed token and shows a recorded check-in", async () => {
    const fetchMock = mockResponse(200, {
      verified: true,
      recorded: true,
      timestamp: "2026-11-09T10:00:00.000Z",
      attendee: { name: "Ada", role: "participant" },
      message: "Attendance recorded.",
    });

    render(<CheckinStatus token={TOKEN} isOpen onClose={jest.fn()} />);

    expect(await screen.findByText("Ada (participant)")).toBeInTheDocument();
    expect(screen.getByText("Checked in")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: TOKEN }),
    });
  });

  it("shows when a repeat scan was first checked in", async () => {
    const timestamp = "2026-11-04T09:00:00.000Z";
    mockResponse(409, {
      error: "Already checked in",
      alreadyCheckedIn: true,
      timestamp,
      attendee: { name: "Ada", role: "participant" },
    });

    render(<CheckinStatus token={TOKEN} isOpen onClose={jest.fn()} />);

    expect(await screen.findByText("Already checked in")).toBeInTheDocument();
    expect(
      screen.getByText(`First scanned: ${new Date(timestamp).toLocaleString()}`)
    ).toBeInTheDocument();
    expect(screen.queryByText("Ticket not accepted")).not.toBeInTheDocument();
  });

  it("shows other failures as not accepted", async () => {
    mockResponse(403, { error: "Only organizers of this event can check attendees in" });

    render(<CheckinStatus token={TOKEN} isOpen onClose={jest.fn()} />);

    expect(await screen.findByText("Ticket not accepted")).toBeInTheDocument();
    expect(screen.getByText(/Only organizers/)).toBeInTheDocument();
  });
});
