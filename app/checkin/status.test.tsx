import { render, screen, waitFor } from "@testing-library/react";
import { CheckinStatus } from "./status";

const TOKEN = "evt=event-1&usr=user-1";

describe("CheckinStatus", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(body: unknown) {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve(body) });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("submits the scan with POST", async () => {
    const fetchMock = mockResponse({ message: "Successfully checked in" });

    render(<CheckinStatus token={TOKEN} isOpen onClose={jest.fn()} />);

    expect(await screen.findByText("Success!")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/checkin?${TOKEN}`, {
      method: "POST",
    });
  });

  it("shows when a repeat scan was first checked in", async () => {
    const timestamp = "2026-11-04T09:00:00.000Z";
    mockResponse({ error: "Already checked in", timestamp });

    render(<CheckinStatus token={TOKEN} isOpen onClose={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Already checked in")).toBeInTheDocument()
    );
    expect(screen.queryByText("Success!")).not.toBeInTheDocument();
    expect(
      screen.getByText(`Time: ${new Date(timestamp).toLocaleString()}`)
    ).toBeInTheDocument();
  });
});
