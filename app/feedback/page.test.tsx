import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FeedbackPage from "./page";

const mockToast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const feedback = [
  {
    id: "feedback-1",
    sender: { name: "Ada", avatar: "/a.png", role: "Mentor" },
    projectName: "Project One",
    message: "Nice work",
    date: "Jan 01, 2026",
    isRead: false,
  },
];

function mockFetch(markReadOk: boolean) {
  global.fetch = jest.fn(async (url: string) =>
    url.startsWith("/api/feedback/mark-read")
      ? ({ ok: markReadOk, json: async () => ({}) } as Response)
      : ({
          ok: true,
          json: async () => ({ feedback, totalPages: 1 }),
        } as Response),
  ) as jest.Mock;
}

describe("FeedbackPage mark all as read", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("clears the unread state when the server saves it", async () => {
    mockFetch(true);
    render(<FeedbackPage />);

    fireEvent.click(await screen.findByText("Mark all 1 as read"));

    await waitFor(() =>
      expect(screen.queryByText("Mark all 1 as read")).not.toBeInTheDocument(),
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("keeps items unread and shows an error when the save fails", async () => {
    mockFetch(false);
    render(<FeedbackPage />);

    fireEvent.click(await screen.findByText("Mark all 1 as read"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(screen.getByText("Mark all 1 as read")).toBeInTheDocument();
  });
});
