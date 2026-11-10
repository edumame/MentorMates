import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrganizerEditOverview } from "./organizer-edit-overview";
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockToast = jest.fn();
let mockSearchParams = new URLSearchParams();
const defaultEventRow = {
  event_id: "sample",
  event_name: "QA Sample Event",
  event_tracks: [],
  visibility: "public",
  approval_status: "approved",
};
let mockEventRow: Record<string, unknown> = { ...defaultEventRow };
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/events/sample/overview",
  useSearchParams: () => mockSearchParams,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/participants",
  () => ({ ParticipantsTab: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/teams", () => ({
  OrganizerTeamsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/access", () => ({
  AccessTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/tracks", () => ({
  EventTracksContainer: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/submissions", () => ({
  SubmissionsTab: () => null,
}));
jest.mock("@/features/user/dashboards/dashboard/organizer/scores", () => ({
  ScoresTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab",
  () => ({ PricingTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("@/features/user/dashboards/dashboard/organizer/email", () => ({
  EmailTab: () => null,
}));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton",
  () => ({ ProjectImport: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/submissions/SubmissionFieldsSettings",
  () => ({ SubmissionFieldsSettings: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/BasicInfoTab",
  () => ({ BasicInfoTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ContentTab",
  () => ({ ContentTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab",
  () => ({ ScheduleTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab",
  () => ({ ResourcesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/RulesTab",
  () => ({ RulesTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/details/FAQTab",
  () => ({ FAQTab: () => null }),
);
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/registration",
  () => ({ IntakeResponsesTab: () => null }),
);
jest.mock("@/components/events/event-card", () => ({ EventCard: () => null }));
jest.mock(
  "@/features/user/dashboards/dashboard/organizer/api-keys/ApiKeysTab",
  () => ({ ApiKeysTab: () => null }),
);
jest.mock("@/features/intake-forms/components/IntakeFormBuilder", () => ({
  IntakeFormBuilder: () => null,
}));
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: mockEventRow }),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ count: 0 }).then(resolve),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockToast.mockClear();
  mockEventRow = { ...defaultEventRow };
  localStorage.clear();
});

afterEach(() => {
  // Only the action tests below install a fetch mock.
  delete (global as { fetch?: unknown }).fetch;
});

it.each(["forms", "intake-forms"])(
  "opens the Forms overview for the %s URL",
  async (tab) => {
    mockSearchParams = new URLSearchParams({ tab, view: "organizer" });
    render(<OrganizerEditOverview eventId="sample" />);
    expect(
      await screen.findByRole("heading", { name: "Event forms" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Forms" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Manage submission form" }),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      `/events/sample/overview?tab=${tab}&view=organizer&subtab=submission`,
      { scroll: false },
    );
  },
);

it("exposes Forms from the default People view and preserves unrelated URL parameters", async () => {
  mockSearchParams = new URLSearchParams({ view: "organizer" });
  render(<OrganizerEditOverview eventId="sample" />);
  fireEvent.mouseDown(await screen.findByRole("tab", { name: "Forms" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(mockReplace).toHaveBeenCalledWith(
    "/events/sample/overview?view=organizer&tab=forms",
    { scroll: false },
  );
});

describe("header actions", () => {
  function mockFetch(response: { ok: boolean; status?: number; body: unknown }) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    });
    (global as { fetch?: unknown }).fetch = fetchMock;
    return fetchMock;
  }

  async function openDeleteDialog() {
    mockSearchParams = new URLSearchParams({ tab: "overview" });
    render(<OrganizerEditOverview eventId="sample" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Delete$/ }));
    return screen.findByRole("alertdialog");
  }

  it("ORG-007: requires typing the event name before Confirm Delete is enabled", async () => {
    const fetchMock = mockFetch({ ok: true, body: { success: true } });
    await openDeleteDialog();
    const confirm = screen.getByRole("button", { name: "Confirm Delete" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/no longer belong to any event/);

    const input = screen.getByLabelText(/to confirm/);
    fireEvent.change(input, { target: { value: "QA Sample" } });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "QA Sample Event" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/events/sample", { method: "DELETE" }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/events"));
  });

  it("ORG-006: shows the server's message and stays on the page when delete is refused", async () => {
    mockFetch({
      ok: false,
      status: 409,
      body: { error: "This event has payment records and cannot be deleted. Archive it instead." },
    });
    await openDeleteDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "QA Sample Event" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: expect.stringMatching(/Archive it instead/),
        }),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([
    [{ error: "Failed to delete event. Nothing was changed." }, "Failed to delete event. Nothing was changed."],
    [{}, "Failed to delete event"],
  ])("ORG-007: a failed delete shows a clear toast (%p)", async (body, message) => {
    mockFetch({ ok: false, status: 500, body });
    await openDeleteDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "QA Sample Event" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: message }),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ORG-005: an archived event offers an enabled Unarchive action", async () => {
    mockEventRow = { ...defaultEventRow, visibility: "archived" };
    const fetchMock = mockFetch({
      ok: true,
      body: { success: true, action: "unarchive", newVisibility: "private" },
    });
    mockSearchParams = new URLSearchParams({ tab: "overview" });
    render(<OrganizerEditOverview eventId="sample" />);
    const button = await screen.findByRole("button", { name: "Unarchive" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Unarchive" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/events/sample",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "unarchive" }) }),
      ),
    );
  });

  it("ORG-020: the submit-for-approval dialog has no decorative visibility selector", async () => {
    mockEventRow = { ...defaultEventRow, visibility: "private", approval_status: "not_submitted" };
    mockSearchParams = new URLSearchParams({ tab: "overview" });
    render(<OrganizerEditOverview eventId="sample" />);
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/request approval now/);
    expect(dialog.querySelector("[role=combobox]")).toBeNull();
  });
});
