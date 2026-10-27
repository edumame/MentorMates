import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmitForParticipantDialog } from "./SubmitForParticipantDialog";

const toast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

// react-markdown ships ESM only; the preview isn't exercised here.
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: ({ value }: { value: string }) => <div>{value}</div>,
}));

jest.mock("@/features/projects/utils/uploadProjectMaterial", () => ({
  uploadProjectMaterialFile: jest.fn(),
}));

const eventId = "event-1";
const submitUrl = `/api/events/${eventId}/projects/submit-for-participant`;

const configuredFields = [
  {
    id: "f-name",
    event_id: eventId,
    key: "project_name",
    label: "Project name",
    placeholder: "Name here",
    field_type: "short_text",
    required: true,
    sort_order: 0,
    is_active: true,
  },
  {
    id: "f-desc",
    event_id: eventId,
    key: "project_description",
    label: "Project description",
    placeholder: "Describe it",
    field_type: "long_text",
    required: true,
    sort_order: 1,
    is_active: true,
  },
  {
    id: "f-demo",
    event_id: eventId,
    key: "demo_link",
    label: "Demo link",
    placeholder: "Demo URL",
    field_type: "short_text",
    required: true,
    sort_order: 2,
    is_active: true,
  },
  {
    id: "f-old",
    event_id: eventId,
    key: "old_question",
    label: "Old question",
    placeholder: "Old",
    field_type: "short_text",
    required: true,
    sort_order: 3,
    is_active: false,
  },
];

function mockFetch(fields: unknown[]) {
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    if (url === `/api/events/${eventId}/submission-fields`) {
      return { ok: true, json: async () => ({ fields }) };
    }
    if (url === submitUrl) {
      return {
        ok: true,
        json: async () => ({ success: true, submitted_after_deadline: true }),
      };
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function submitCalls() {
  return (global.fetch as jest.Mock).mock.calls.filter(([url]) => url === submitUrl);
}

function renderDialog() {
  const onSubmitted = jest.fn();
  render(
    <SubmitForParticipantDialog
      open
      onOpenChange={jest.fn()}
      eventId={eventId}
      participantUserId="participant-1"
      participantDisplayName="Pat"
      onSubmitted={onSubmitted}
    />,
  );
  return { onSubmitted };
}

describe("SubmitForParticipantDialog", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    toast.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("renders the event's configured fields and blocks publishing until required answers are filled", async () => {
    const user = userEvent.setup();
    mockFetch(configuredFields);
    renderDialog();

    await user.type(await screen.findByPlaceholderText("Name here"), "Rescue");
    await user.type(screen.getByPlaceholderText("Describe it"), "Late but great");
    expect(screen.queryByPlaceholderText("Old")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: '"Demo link" is required' }),
    );
    expect(submitCalls()).toHaveLength(0);

    await user.type(screen.getByPlaceholderText("Demo URL"), "https://demo.test");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submitCalls()).toHaveLength(1));
    const body = JSON.parse(submitCalls()[0][1].body);
    expect(body).toEqual({
      participant_user_id: "participant-1",
      submit_immediately: true,
      project: {
        project_name: "Rescue",
        project_description: "Late but great",
        submission_answers: [
          { eventSubmissionFieldId: "f-name", answer: "Rescue" },
          { eventSubmissionFieldId: "f-desc", answer: "Late but great" },
          { eventSubmissionFieldId: "f-demo", answer: "https://demo.test" },
        ],
      },
    });
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Project submitted",
          description: expect.stringContaining("after the submission deadline"),
        }),
      ),
    );
  });

  it("lets drafts skip required configured answers, like participant drafts", async () => {
    const user = userEvent.setup();
    mockFetch(configuredFields);
    renderDialog();

    await user.type(await screen.findByPlaceholderText("Name here"), "Draft");
    await user.type(screen.getByPlaceholderText("Describe it"), "WIP");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(submitCalls()).toHaveLength(1));
    expect(JSON.parse(submitCalls()[0][1].body).submit_immediately).toBe(false);
  });

  it("falls back to the default inputs and requires a description when no fields are configured", async () => {
    const user = userEvent.setup();
    mockFetch([]);
    renderDialog();

    await user.type(await screen.findByLabelText("Project name *"), "Plain");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(submitCalls()).toHaveLength(0);

    await user.type(screen.getByLabelText("Description *"), "Desc");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitCalls()).toHaveLength(1));
    expect(JSON.parse(submitCalls()[0][1].body).project).toEqual({
      project_name: "Plain",
      project_description: "Desc",
    });
  });

  it("does not allow submitting when the submission form fails to load", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load this event's submission form.",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});
