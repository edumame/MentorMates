import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BasicInfoTab } from "./BasicInfoTab";
import { ApprovalStatus, EventDetails, EventVisibility } from "@/lib/types";

jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/markdown/plugins", () => ({
  markdownRemarkPlugins: [],
  markdownRehypePlugins: [],
}));
jest.mock("@/components/markdown/custom-components", () => ({
  customMarkdownComponents: {},
}));

const mockFetch = jest.fn();
const setEvent = jest.fn();
const toast = jest.fn();
const router = { refresh: jest.fn(), push: jest.fn() };

function mockArchiveResponse(newVisibility: string, approvalStatus: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, newVisibility, approvalStatus }),
  });
}

function renderTab(
  visibility: EventVisibility,
  approval_status: ApprovalStatus,
): EventDetails {
  const event = {
    event_id: "sample",
    event_name: "Sample",
    visibility,
    approval_status,
  } as unknown as EventDetails;
  render(
    <BasicInfoTab
      event={event}
      setEvent={setEvent}
      saving={false}
      setSaving={jest.fn()}
      toast={toast as never}
      router={router as never}
    />,
  );
  return event;
}

async function confirm(trigger: string, action: string) {
  fireEvent.click(screen.getByRole("button", { name: trigger }));
  fireEvent.click(await screen.findByRole("button", { name: action }));
  await waitFor(() => expect(setEvent).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
});

it("stores the withdrawn status when archiving a submitted event", async () => {
  mockArchiveResponse("archived", "not_submitted");
  const event = renderTab(EventVisibility.Private, ApprovalStatus.Submitted);

  await confirm("Archive", "Confirm Archive");

  expect(mockFetch).toHaveBeenCalledWith(
    "/api/events/sample",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ action: "archive" }),
    }),
  );
  expect(setEvent).toHaveBeenCalledWith({
    ...event,
    visibility: "archived",
    approval_status: "not_submitted",
  });
});

it("keeps an approved status when archiving", async () => {
  mockArchiveResponse("archived", "approved");
  const event = renderTab(EventVisibility.Public, ApprovalStatus.Approved);

  await confirm("Archive", "Confirm Archive");

  expect(setEvent).toHaveBeenCalledWith({
    ...event,
    visibility: "archived",
    approval_status: "approved",
  });
});

it("stores the status the route returns when unarchiving", async () => {
  mockArchiveResponse("private", "not_submitted");
  const event = renderTab(EventVisibility.Archived, ApprovalStatus.NotSubmitted);

  await confirm("Unarchive", "Confirm Unarchive");

  expect(mockFetch).toHaveBeenCalledWith(
    "/api/events/sample",
    expect.objectContaining({
      body: JSON.stringify({ action: "unarchive" }),
    }),
  );
  expect(setEvent).toHaveBeenCalledWith({
    ...event,
    visibility: "private",
    approval_status: "not_submitted",
  });
});

it("leaves local state alone when the archive request fails", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Nope" }),
  });
  const consoleError = jest.spyOn(console, "error").mockImplementation();
  renderTab(EventVisibility.Private, ApprovalStatus.Submitted);

  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm Archive" }));

  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Nope", variant: "destructive" }),
    ),
  );
  expect(setEvent).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
