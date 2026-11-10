import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewEventPage from "./page";
import type { WizardEventData } from "@/lib/types/wizard";

const push = jest.fn();
const toast = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: jest.fn() }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: "u1", email: "org@example.com" } } },
      })),
    },
    rpc: jest.fn(async () => ({ data: false })),
  },
}));
jest.mock("./components/DetailsStep", () => ({ DetailsStep: () => null }));
jest.mock("./components/WizardSubmissionStep", () => ({
  WizardSubmissionStep: () => null,
}));
jest.mock("./components/WizardJudgingStep", () => ({
  WizardJudgingStep: () => null,
}));
jest.mock("./components/WizardInviteStep", () => ({
  WizardInviteStep: () => null,
}));
jest.mock("./components/WizardShell", () => ({
  WizardShell: ({
    setEvent,
  }: {
    setEvent: (update: (prev: WizardEventData) => WizardEventData) => void;
  }) => (
    <button
      onClick={() =>
        setEvent((prev) => ({
          ...prev,
          event_name: "Hack",
          event_date: "2026-12-01",
          location: "Online",
          submission_fields: [
            {
              id: "tech_stack",
              label: "Tech stack",
              type: "text",
              required: false,
              placeholder: "",
            },
          ],
        }))
      }
    >
      fill event
    </button>
  ),
}));

const oldFetch = global.fetch;
const fetchMock = jest.fn();

function mockFieldsSave(save: () => Promise<unknown>) {
  fetchMock.mockImplementation((url: string) =>
    url === "/api/events"
      ? Promise.resolve({
          ok: true,
          json: async () => ({ event: { event_id: "e1", event_name: "Hack", slug: "hack" } }),
        })
      : save(),
  );
}

async function saveDraft() {
  render(<NewEventPage />);
  fireEvent.click(await screen.findByText("fill event"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save Draft"));
  });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/events/hack/overview"));
}

const titles = () => toast.mock.calls.map(([arg]) => arg.title);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
});

afterAll(() => {
  global.fetch = oldFetch;
});

describe("NewEventPage submission field save", () => {
  it("reports a rejected save, and no success toast replaces it", async () => {
    mockFieldsSave(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({
          error: "Locked submission fields cannot be removed.",
          code: "locked_field_missing",
        }),
      }),
    );

    await saveDraft();

    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Submission form not saved",
        description: expect.stringContaining("Locked submission fields cannot be removed."),
        variant: "destructive",
      }),
    );
    expect(titles()).not.toContain("Event saved as draft");
  });

  it("reports a rejected save whose body is not JSON", async () => {
    mockFieldsSave(() =>
      Promise.resolve({
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await saveDraft();

    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Submission form not saved",
        variant: "destructive",
      }),
    );
  });

  it("reports a network failure during the save", async () => {
    mockFieldsSave(() => Promise.reject(new Error("offline")));

    await saveDraft();

    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Submission form not saved",
        variant: "destructive",
      }),
    );
  });

  it("shows the normal success toast when the save works", async () => {
    mockFieldsSave(() => Promise.resolve({ ok: true, json: async () => ({ fields: [] }) }));

    await saveDraft();

    expect(titles()).toEqual(["Event saved as draft"]);
  });
});
