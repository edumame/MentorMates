import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./page";

const USER_ID = "user-1";
const mockGetSession = jest.fn();
const mockRpc = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ userId: "user-1" }),
  useSearchParams: () => new URLSearchParams("edit=1"),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock(
  "@/features/projects/components/displays/ProjectBoard/ProjectBoard",
  () => ({
    __esModule: true,
    default: () => null,
  })
);

const fetchMock = jest.fn();

const linkedinInput = () => screen.getByPlaceholderText("LinkedIn Profile URL");
const saveButton = () =>
  screen.getByRole("button", { name: /^(Save|Saving\.\.\.)$/ });
const patchCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");

async function renderEditModal() {
  render(<ProfilePage />);
  await screen.findByText("Edit profile", { selector: "h2" });
}

function submitInvalidLinkedin() {
  fireEvent.change(linkedinInput(), {
    target: { value: "linkedin.com/in/jane" },
  });
  fireEvent.click(saveButton());
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: USER_ID } } },
    error: null,
  });
  mockRpc.mockResolvedValue({ data: false, error: null });
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return { ok: true, json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => ({
        profile: { display_name: "Jane", links: {} },
        projects: [],
        events: [],
      }),
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ProfilePage edit modal save state", () => {
  it("keeps Save usable after a client-side validation error", async () => {
    await renderEditModal();

    submitInvalidLinkedin();

    expect(await screen.findByText("Invalid LinkedIn URL")).toBeInTheDocument();
    expect(saveButton()).toHaveTextContent(/^Save$/);
    expect(saveButton()).toBeEnabled();
    expect(patchCalls()).toHaveLength(0);
  });

  it("saves once the invalid field is corrected", async () => {
    await renderEditModal();

    submitInvalidLinkedin();
    await screen.findByText("Invalid LinkedIn URL");

    fireEvent.change(linkedinInput(), {
      target: { value: "https://linkedin.com/in/jane" },
    });
    fireEvent.click(saveButton());

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    const [url, init] = patchCalls()[0];
    expect(url).toBe(`/api/users/${USER_ID}`);
    expect(JSON.parse(init.body).links).toEqual({
      linkedin: "https://linkedin.com/in/jane",
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Edit profile", { selector: "h2" })
      ).not.toBeInTheDocument()
    );
  });

  it("leaves Save usable after cancelling and reopening the modal", async () => {
    await renderEditModal();

    submitInvalidLinkedin();
    await screen.findByText("Invalid LinkedIn URL");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));

    await screen.findByText("Edit profile", { selector: "h2" });
    expect(saveButton()).toHaveTextContent(/^Save$/);
    expect(saveButton()).toBeEnabled();
  });

  it("shows Saving... and blocks a second submit while a valid save is in flight", async () => {
    let resolvePatch: (value: unknown) => void = () => {};
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "PATCH"
        ? new Promise((resolve) => {
            resolvePatch = resolve;
          })
        : baseFetch(url, init)
    );
    await renderEditModal();

    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toHaveTextContent("Saving..."));
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(patchCalls()).toHaveLength(1);

    resolvePatch({ ok: true, json: async () => ({}) });
    await waitFor(() =>
      expect(
        screen.queryByText("Edit profile", { selector: "h2" })
      ).not.toBeInTheDocument()
    );
  });
});
