import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import CheckinPage from "./page";

const mockUseSearchParams = useSearchParams as jest.Mock;

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

jest.mock("@/components/utils/QRScanner", () => ({
  __esModule: true,
  default: ({ onTokenScanned }: { onTokenScanned: (token: string) => void }) => (
    <button onClick={() => onTokenScanned(mockScannedToken)}>
      Simulate scan
    </button>
  ),
}));

let mockScannedToken = "";

describe("CheckinPage", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      json: async () => ({ message: "Successfully checked in" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  async function scan(token: string) {
    mockScannedToken = token;
    fireEvent.click(screen.getByRole("button", { name: "Simulate scan" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await screen.findByText("Successfully checked in");
    return new URL(fetchMock.mock.calls[0][0], "http://localhost");
  }

  it("does not offer the scanner without a scanning event", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    render(<CheckinPage />);

    expect(
      screen.queryByRole("button", { name: "Simulate scan" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/no event selected/i);
  });

  it("sends the scanning event with the ticket", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("event=event-b"));

    render(<CheckinPage />);
    const url = await scan("evt=event-a&usr=user-1");

    expect(url.pathname).toBe("/api/checkin");
    expect(url.searchParams.get("event")).toBe("event-b");
    expect(url.searchParams.get("evt")).toBe("event-a");
    expect(url.searchParams.get("usr")).toBe("user-1");
  });

  it("does not let a crafted QR replace the scanning event", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("event=event-b"));

    render(<CheckinPage />);
    const url = await scan("event=event-a&evt=event-a&usr=user-1");

    expect(url.searchParams.getAll("event")).toEqual(["event-b"]);
  });
});
