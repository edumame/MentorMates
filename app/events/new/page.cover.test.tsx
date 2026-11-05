import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WizardEventData } from "@/lib/types/wizard";
import NewEventPage from "./page";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }),
}));

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: "u1", email: "org@test.dev" } } },
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
  },
}));

const attachEventCoverImage = jest.fn();
jest.mock("@/lib/utils/event-cover", () => ({
  attachEventCoverImage: (...args: unknown[]) => attachEventCoverImage(...args),
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

const fetchMock = jest.fn();
const oldFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  coverFile = new File(["x"], "c.png", { type: "image/png" });
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ event: { event_id: "evt-1", slug: "hack", event_name: "Hack" } }),
  });
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

it("uploads the cover only after the event is created, then attaches it", async () => {
  const order: string[] = [];
  fetchMock.mockImplementation(async () => {
    order.push("create");
    return {
      ok: true,
      json: async () => ({ event: { event_id: "evt-1", slug: "hack", event_name: "Hack" } }),
    };
  });
  attachEventCoverImage.mockImplementation(async () => {
    order.push("attach");
    return "https://cdn.test/c.png";
  });

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
  expect(order).toEqual(["create", "attach"]);
  expect(attachEventCoverImage).toHaveBeenCalledWith(expect.anything(), "evt-1", coverFile);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.event.cover_image_url).toBeUndefined();
});

it("still finishes creating the event and warns when the cover upload fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  attachEventCoverImage.mockRejectedValue(new Error("rls"));

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Cover image not uploaded", variant: "destructive" })
  );
});

it("blocks creation when the picked file is not a valid image", async () => {
  coverFile = new File(["x"], "doc.pdf", { type: "application/pdf" });

  await fillAndSaveDraft();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(attachEventCoverImage).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Cover image problem", description: "Please upload an image file." })
  );
});

it("does not try to upload when no file was picked", async () => {
  coverFile = undefined as unknown as File;

  await fillAndSaveDraft();

  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(attachEventCoverImage).not.toHaveBeenCalled();
});
