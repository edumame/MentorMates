import { render, screen, waitFor } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import SubmitTranscriptButton from "./SubmitTranscriptButton";

jest.mock("@tanstack/react-query", () => ({ useSuspenseQuery: jest.fn() }));
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({ meetings: { getOne: { queryOptions: jest.fn() } } }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const renderWithStatus = async (status: string) => {
  (useSuspenseQuery as jest.Mock).mockReturnValue({ data: { id: "meeting", status } });
  render(<SubmitTranscriptButton meetingId="meeting" />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hasUserMessages: true }) });
});

it("offers a review for an upcoming meeting, including one released after a failed job", async () => {
  await renderWithStatus("upcoming");
  expect(screen.getByRole("button", { name: "Get review" })).toBeEnabled();
});

it("does not claim a review exists while the meeting is still processing", async () => {
  await renderWithStatus("processing");
  expect(screen.getByRole("button", { name: "Review processing" })).toBeDisabled();
  expect(screen.queryByText("Review ready")).not.toBeInTheDocument();
});

it("shows a finished review as ready", async () => {
  await renderWithStatus("completed");
  expect(screen.getByRole("button", { name: "Review ready" })).toBeDisabled();
});
