import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./page";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const mockUpload = jest.fn();
const mockToast = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ userId: "user-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

jest.mock(
  "@/features/projects/components/displays/ProjectBoard/ProjectBoard",
  () => ({ __esModule: true, default: () => null })
);

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
    },
    rpc: () => Promise.resolve({ data: false, error: null }),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: () => ({
          data: { publicUrl: "https://cdn.test/avatar.png" },
        }),
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

const imageFile = (name: string) =>
  new File(["image-bytes"], name, { type: "image/png" });

const fileInputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="file"]')
  );
const headerInput = () => fileInputs()[0];
const modalInput = () => fileInputs()[1];

const pick = (input: HTMLInputElement, file: File) =>
  fireEvent.change(input, { target: { files: [file] } });

async function renderOwnProfile() {
  render(<ProfilePage />);
  return screen.findByRole("button", { name: "Edit" });
}

async function openEditModal() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  await screen.findByRole("heading", { name: "Edit profile" });
  expect(fileInputs()).toHaveLength(2);
}

const uploadedFile = () => mockUpload.mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        profile: { display_name: "Dev User", links: {} },
        projects: [],
        events: [],
      }),
  }) as unknown as typeof fetch;
});

describe("profile avatar upload", () => {
  it("uploads the file chosen in the edit modal", async () => {
    await renderOwnProfile();
    await openEditModal();

    const file = imageFile("modal.png");
    pick(modalInput(), file);
    await screen.findByText("New image selected");

    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(uploadedFile()).toBe(file);
    await waitFor(() =>
      expect(screen.queryByText("New image selected")).not.toBeInTheDocument()
    );
  });

  it("uploads the file chosen in the header overlay", async () => {
    await renderOwnProfile();

    const file = imageFile("header.png");
    pick(headerInput(), file);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(uploadedFile()).toBe(file);
  });

  it("ignores a header pick that was cancelled before the modal pick", async () => {
    await renderOwnProfile();

    pick(headerInput(), imageFile("cancelled.png"));
    await screen.findByRole("button", { name: "Save" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save" })
      ).not.toBeInTheDocument()
    );

    await openEditModal();
    const file = imageFile("modal.png");
    pick(modalInput(), file);
    await screen.findByText("New image selected");
    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(uploadedFile()).toBe(file);
  });

  it("uploads the latest pick when a newer file replaces a pending one", async () => {
    await renderOwnProfile();

    pick(headerInput(), imageFile("older.png"));
    await screen.findByRole("button", { name: "Save" });

    await openEditModal();
    const file = imageFile("newer.png");
    const readAsDataURL = jest.spyOn(FileReader.prototype, "readAsDataURL");
    pick(modalInput(), file);
    // "Save image" is already visible from the older pick, so wait for the read.
    const reader = readAsDataURL.mock.contexts[0] as FileReader;
    await waitFor(() => expect(reader.readyState).toBe(FileReader.DONE));
    readAsDataURL.mockRestore();

    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(uploadedFile()).toBe(file);
  });

  it("does not keep a rejected oversized file for a later save", async () => {
    await renderOwnProfile();

    const oversized = imageFile("huge.png");
    Object.defineProperty(oversized, "size", { value: MAX_AVATAR_BYTES + 1 });
    pick(headerInput(), oversized);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "File too large" })
    );

    await openEditModal();
    const file = imageFile("modal.png");
    pick(modalInput(), file);
    await screen.findByText("New image selected");
    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(uploadedFile()).toBe(file);
  });

  it("keeps the pending file so a failed upload can be retried", async () => {
    await renderOwnProfile();
    await openEditModal();
    mockUpload.mockResolvedValueOnce({ error: new Error("network") });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const file = imageFile("modal.png");
    pick(modalInput(), file);
    await screen.findByText("New image selected");
    fireEvent.click(screen.getByRole("button", { name: "Save image" }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Upload failed" })
      )
    );

    fireEvent.click(await screen.findByRole("button", { name: "Save image" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(mockUpload.mock.calls[1][1]).toBe(file);
    consoleError.mockRestore();
  });

  it("clears the input after a pick so the same file can be chosen again", async () => {
    await renderOwnProfile();
    await openEditModal();

    const setValue = jest.spyOn(modalInput(), "value", "set");
    pick(modalInput(), imageFile("modal.png"));

    expect(setValue).toHaveBeenCalledWith("");
    await screen.findByText("New image selected");
  });
});
