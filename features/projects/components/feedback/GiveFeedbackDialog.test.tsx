import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GiveFeedbackDialog } from "./GiveFeedbackDialog";

jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));

const suggestions = { "more specific": "Specific!", "more actionable": "Act!", "more positive": "Yay!" };

function mockFetch(available: boolean) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/feedback/suggest" && !init) return { ok: true, status: 200, json: async () => ({ available }) };
    if (url === "/api/feedback/suggest") return { ok: true, status: 200, json: async () => ({ suggestions }) };
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const renderDialog = () =>
  render(<GiveFeedbackDialog open onOpenChange={jest.fn()} projectName="Demo" projectId="p1" eventId="e1" />);

afterEach(() => localStorage.clear());

it("hides the AI button when the server reports AI unavailable", async () => {
  const fetchMock = mockFetch(false);
  renderDialog();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feedback/suggest"));
  expect(screen.queryByText("Improve feedback with AI")).not.toBeInTheDocument();
});

it("never calls a third-party host and records the original draft only after AI use", async () => {
  const fetchMock = mockFetch(true);
  localStorage.setItem("originalFeedback_p1", "stale draft from another session");
  renderDialog();
  fireEvent.change(screen.getByPlaceholderText("Long description or markdown"), { target: { value: "my draft" } });
  fireEvent.click(await screen.findByText("Improve feedback with AI"));
  await screen.findByText("Specific!");
  const suggestCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/feedback/suggest" && init);
  expect(JSON.parse(String(suggestCall?.[1]?.body))).toEqual({ projectId: "p1", feedback: "my draft" });
  fireEvent.change(screen.getByPlaceholderText("Long description or markdown"), { target: { value: "final text" } });
  fireEvent.click(screen.getByText("Submit feedback"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feedback/submit/p1", expect.anything()));
  const submit = fetchMock.mock.calls.find(([url]) => url === "/api/feedback/submit/p1");
  expect(JSON.parse(String(submit?.[1]?.body))).toMatchObject({
    feedback_text: "final text",
    original_feedback_text: "my draft",
    modifier_field: ["ai_enhanced"],
  });
  expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/"))).toBe(true);
});

it("ignores stale localStorage drafts when AI was not used", async () => {
  const fetchMock = mockFetch(false);
  localStorage.setItem("originalFeedback_p1", "stale draft");
  renderDialog();
  fireEvent.change(screen.getByPlaceholderText("Long description or markdown"), { target: { value: "plain" } });
  fireEvent.click(screen.getByText("Submit feedback"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feedback/submit/p1", expect.anything()));
  const submit = fetchMock.mock.calls.find(([url]) => url === "/api/feedback/submit/p1");
  expect(JSON.parse(String(submit?.[1]?.body))).toMatchObject({ original_feedback_text: "plain", modifier_field: [] });
});
