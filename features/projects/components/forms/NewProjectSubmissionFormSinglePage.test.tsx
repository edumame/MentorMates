import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewProjectSubmissionFormSinglePage } from "./NewProjectSubmissionFormSinglePage";
import { toast } from "@/lib/hooks/use-toast";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { event_id: "event-1", slug: "demo-event" },
            error: null,
          }),
        }),
      }),
    }),
  },
}));
jest.mock(
  "@/features/projects/components/forms/hooks/useProjectSubmissionData",
  () => ({
    useProjectSubmissionData: () => ({
      availableTracks: [
        { id: "track-1", name: "Health" },
        { id: "track-2", name: "Climate" },
      ],
    }),
  })
);
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  default: ({ onTagsChange }: { onTagsChange: (tags: string[]) => void }) => (
    <button type="button" onClick={() => onTagsChange(["mate@example.com"])}>
      Add teammate
    </button>
  ),
}));
jest.mock("@/components/events/event-card", () => ({ EventCard: () => null }));
jest.mock("@/features/intake-forms/components/ParticipantIntakeDialog", () => ({
  ParticipantIntakeDialog: () => null,
}));
jest.mock(
  "@/features/projects/components/forms/components/ProjectPrivacySelect",
  () => ({ ProjectPrivacySelect: () => null })
);
jest.mock(
  "@/features/projects/components/displays/cover-image-with-fallback",
  () => ({ CoverImageWithFallback: () => null })
);
jest.mock(
  "@/features/projects/components/displays/ProjectFieldEntriesSection",
  () => ({ ProjectFieldEntriesSection: () => null })
);
jest.mock(
  "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection",
  () => ({
    ProjectSubmissionSchemaSection: ({
      fields,
      values,
      onValueChange,
    }: {
      fields: Array<{ key: string }>;
      values: Record<string, string | string[]>;
      onValueChange: (key: string, value: string) => void;
    }) => (
      <>
        {fields.map((field) => (
          <input
            key={field.key}
            aria-label={field.key}
            value={typeof values[field.key] === "string" ? values[field.key] : ""}
            onChange={(event) => onValueChange(field.key, event.target.value)}
          />
        ))}
      </>
    ),
  })
);

type FetchInit = { method?: string; body?: string };

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

function mockFetch(createDraft?: () => Promise<unknown>) {
  global.fetch = jest.fn((url: string, init?: FetchInit) => {
    if (url === "/api/projects" && init?.method === "POST") {
      return createDraft ? createDraft() : Promise.resolve(jsonResponse({ id: "project-1" }));
    }
    if (url === "/api/projects/project-1" && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ project: { id: "project-1" } }));
    }
    return Promise.resolve(jsonResponse({ users: [], fields: [] }));
  }) as unknown as typeof fetch;
}

const callsTo = (url: string, method: string) =>
  (fetch as jest.Mock).mock.calls.filter(
    ([calledUrl, init]) => calledUrl === url && init?.method === method
  );

const lastPatchBody = () =>
  JSON.parse(callsTo("/api/projects/project-1", "PATCH").at(-1)[1].body);

async function renderForm() {
  render(
    <NewProjectSubmissionFormSinglePage
      eventId="event-1"
      leadName="Lead"
      userEmail="lead@example.com"
    />
  );
  // Autosave only runs once the event details have finished loading.
  await screen.findByLabelText("project_name");
  await act(async () => {
    await Promise.resolve();
  });
}

const clickSaveAndExit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save draft and exit" }));
  });
};

const draftCreated = () =>
  waitFor(() => expect(callsTo("/api/projects", "POST")).toHaveLength(1));

describe("NewProjectSubmissionFormSinglePage Save draft and exit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch();
  });

  it("saves the selected tracks with the draft", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText("project_name"), {
      target: { value: "Relief Map" },
    });
    await draftCreated();
    fireEvent.click(screen.getByLabelText("Health"));
    fireEvent.click(screen.getByLabelText("Climate"));
    await act(async () => {
      await Promise.resolve();
    });

    await clickSaveAndExit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/events/demo-event/overview"));
    expect(lastPatchBody().track_ids).toEqual(["track-1", "track-2"]);
  });

  it("saves a deselected track as removed", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText("project_name"), {
      target: { value: "Relief Map" },
    });
    await draftCreated();
    fireEvent.click(screen.getByLabelText("Health"));
    fireEvent.click(screen.getByLabelText("Health"));
    await act(async () => {
      await Promise.resolve();
    });

    await clickSaveAndExit();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(lastPatchBody().track_ids).toEqual([]);
  });

  it("creates a draft for a form where only tracks were picked", async () => {
    await renderForm();
    fireEvent.click(screen.getByLabelText("Health"));
    await draftCreated();
    await act(async () => {
      await Promise.resolve();
    });

    await clickSaveAndExit();

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(lastPatchBody().track_ids).toEqual(["track-1"]);
  });

  it.each([
    ["a video link", () =>
      fireEvent.change(screen.getByLabelText("video_url"), {
        target: { value: "https://example.com/demo" },
      })],
    ["a teammate", () =>
      fireEvent.click(screen.getByRole("button", { name: "Add teammate" }))],
  ])("creates a draft for a form holding only %s", async (_label, enterInput) => {
    await renderForm();
    enterInput();
    await draftCreated();
  });

  it("exits a blank form without creating a draft or showing an error", async () => {
    await renderForm();

    await clickSaveAndExit();

    expect(push).toHaveBeenCalledWith("/events/demo-event/overview");
    expect(toast).not.toHaveBeenCalled();
    expect(callsTo("/api/projects", "POST")).toHaveLength(0);
  });

  it("treats whitespace-only input as blank", async () => {
    await renderForm();
    fireEvent.change(screen.getByLabelText("project_name"), {
      target: { value: "   " },
    });

    await clickSaveAndExit();

    expect(push).toHaveBeenCalled();
    expect(callsTo("/api/projects", "POST")).toHaveLength(0);
  });

  it("stays on the page while the draft holding typed input is still being created", async () => {
    mockFetch(() => new Promise(() => {}));
    await renderForm();
    fireEvent.change(screen.getByLabelText("project_name"), {
      target: { value: "Relief Map" },
    });
    await draftCreated();

    await clickSaveAndExit();

    expect(push).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to save draft" })
    );
  });
});
