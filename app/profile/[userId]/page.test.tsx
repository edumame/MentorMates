import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./page";

const USER_ID = "user-1";

const mockGetSession = jest.fn();
let mockEditParam: string | null = "1";

jest.mock("next/navigation", () => ({
  useParams: () => ({ userId: USER_ID }),
  useSearchParams: () => ({
    get: (key: string) => (key === "edit" ? mockEditParam : null),
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
  },
}));

jest.mock(
  "@/features/projects/components/displays/ProjectBoard/ProjectBoard",
  () => ({ __esModule: true, default: () => null })
);

const savedProfile = {
  display_name: "Ann",
  bio: "hello",
  links: { github: "https://github.com/ann" },
  affiliation: "State U",
  phone_number: "5551234567",
};

function mockProfileApi(getResponse: Partial<Response> & { ok: boolean }) {
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PATCH"
      ? ({ ok: true, json: async () => ({}) } as Response)
      : (getResponse as Response)
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const nameInput = () => screen.findByPlaceholderText("Your name");
const descriptionInput = () =>
  screen.findByPlaceholderText("Short description shown in your profile page");

describe("ProfilePage ?edit=1 auto-open", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockEditParam = "1";
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_ID } } },
      error: null,
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockSavedProfile() {
    return mockProfileApi({
      ok: true,
      json: async () => ({ profile: savedProfile, projects: [], events: [] }),
    });
  }

  it("pre-fills the modal with the saved profile", async () => {
    mockSavedProfile();
    render(<ProfilePage />);

    expect(await nameInput()).toHaveValue("Ann");
    expect(await descriptionInput()).toHaveValue("hello");
  });

  it("keeps untouched fields when saving", async () => {
    const fetchMock = mockSavedProfile();
    render(<ProfilePage />);
    await descriptionInput();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Your name")).not.toBeInTheDocument()
    );
    const patch = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PATCH"
    );
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      display_name: "Ann",
      bio: "hello",
      links: savedProfile.links,
      affiliation: "State U",
      phone_number: "5551234567",
    });
    expect(screen.getByRole("heading", { name: "Ann" })).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("does not open an empty modal when the profile fails to load", async () => {
    const fetchMock = mockProfileApi({
      ok: false,
      json: async () => ({ error: "boom" }),
    });
    render(<ProfilePage />);

    await screen.findByRole("heading", { name: "User Profile" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText("Your name")).not.toBeInTheDocument();
  });

  it("stays closed without the edit param", async () => {
    mockEditParam = null;
    mockSavedProfile();
    render(<ProfilePage />);

    await screen.findByRole("heading", { name: "Ann" });

    expect(screen.queryByPlaceholderText("Your name")).not.toBeInTheDocument();
  });
});
