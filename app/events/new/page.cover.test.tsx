import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WizardEventData } from "@/lib/types/wizard";
import NewEventPage from "./page";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }),
}));

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

// Records the cover_image_url write that follows a successful upload.
const updateEq = jest.fn();
const update = jest.fn();
const from = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: "u1", email: "org@test.dev" } } },
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
    from: (...args: unknown[]) => from(...args),
  },
}));

// Keep the real validateCoverImage so invalid files are refused for real;
// only the storage upload is mocked.
const uploadEventCoverImage = jest.fn();
jest.mock("@/features/user/dashboards/dashboard/organizer/details/cover-image", () => ({
  ...jest.requireActual("@/features/user/dashboards/dashboard/organizer/details/cover-image"),
  uploadEventCoverImage: (...args: unknown[]) => uploadEventCoverImage(...args),
}));

jest.mock("./components/DetailsStep", () => ({ DetailsStep: () => null }));
jest.mock("./components/WizardSubmissionStep", () => ({ WizardSubmissionStep: () => null }));
jest.mock("./components/WizardJudgingStep", () => ({ WizardJudgingStep: () => null }));
jest.mock("./components/WizardInviteStep", () => ({ WizardInviteStep: () => null }));
jest.mock("@/components/events/submission", () => ({ fieldsToApiPayload: (f: unknown) => f }));

// Replace the wizard UI with a button that fills the required fields + a cover file.
let coverFile: File;
jest.mock("./components/WizardShell", () => ({
  WizardShell: ({
    setEvent,
  }: {
    setEvent: (fn: (prev: WizardEventData) => WizardEventData) => void;
  }) => (
    <button
      onClick={() =>
        setEvent((prev) => ({
          ...prev,
          event_name: "Hack",
          event_date: "2026-12-01",
          location: "Venue",
          cover_image_url: "",
          cover_image_file: coverFile,
        }))
      }
    >
      fill
    </button>
  ),
}));

const createdResponse = () => ({
  ok: true,
  json: async () => ({ event: { event_id: "evt-1", slug: "hack", event_name: "Hack" } }),
});

const fetchMock = jest.fn();
const oldFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  coverFile = new File(["x"], "c.png", { type: "image/png" });
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async () => createdResponse());
  updateEq.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq: updateEq });
  from.mockReturnValue({ update });
  uploadEventCoverImage.mockResolvedValue("https://cdn.test/c.png");
});
afterAll(() => {
  global.fetch = oldFetch;
});

async function fillAndSaveDraft() {
  render(<NewEventPage />);
  fireEvent.click(await screen.findByText("fill"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
  });
}

const createCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/events");

it("uploads the cover only after the event is created, then saves it on that event", async () => {
  const order: string[] = [];
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/events") order.push("create");
    return createdResponse();
  });
  uploadEventCoverImage.mockImplementation(async () => {
    order.push("upload");
    return "https://cdn.test/c.png";
  });
  updateEq.mockImplementation(async () => {
    order.push("attach");
    return { error: null };
  });

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
  expect(order).toEqual(["create", "upload", "attach"]);
  expect(uploadEventCoverImage).toHaveBeenCalledWith(expect.anything(), "evt-1", coverFile);
  expect(from).toHaveBeenCalledWith("events");
  expect(update).toHaveBeenCalledWith({ cover_image_url: "https://cdn.test/c.png" });
  expect(updateEq).toHaveBeenCalledWith("event_id", "evt-1");
  const body = JSON.parse(createCalls()[0][1].body);
  expect(body.event.cover_image_url).toBeFalsy();
  expect(toast).not.toHaveBeenCalledWith(
    expect.objectContaining({ title: "Cover image not saved" })
  );
});

it("still finishes creating the event and warns when the cover upload fails", async () => {
  uploadEventCoverImage.mockRejectedValue(new Error("Upload failed"));

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
  expect(update).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Cover image not saved",
      description: "Upload failed",
      variant: "destructive",
    })
  );
});

it("still finishes creating the event and warns when saving the cover URL fails", async () => {
  updateEq.mockResolvedValue({ error: { message: "rls" } });

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Cover image not saved", variant: "destructive" })
  );
});

it("blocks creation when the picked file is not a valid image", async () => {
  coverFile = new File(["x"], "doc.pdf", { type: "application/pdf" });

  await fillAndSaveDraft();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(uploadEventCoverImage).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Check the cover image",
      description: "Cover image must be a PNG, JPEG, WebP or GIF.",
      variant: "destructive",
    })
  );
});

it("does not try to upload when no file was picked", async () => {
  coverFile = undefined as unknown as File;

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(uploadEventCoverImage).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
