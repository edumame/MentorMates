import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewProjectSubmissionFormSinglePage } from "./NewProjectSubmissionFormSinglePage";
import { toast } from "@/lib/hooks/use-toast";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

const HEALTH_TRACK = "11111111-1111-4111-8111-111111111111";
const CLIMATE_TRACK = "22222222-2222-4222-8222-222222222222";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
// saveProjectSubmission writes tracks atomically with the service client.
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({
    rpc: (fn: string, args: unknown) => mockServiceRpc(fn, args),
  }),
}));
jest.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/lib/integrations/contextus", () => ({
  createContextusProject: jest.fn(),
}));
jest.mock("@/lib/projects/query", () => ({
  fetchArtifactsByProjectIds: async () => new Map(),
  fetchSubmissionAnswersByProjectIds: async () => new Map(),
  fetchSubmissionFieldsByEventIds: async () => new Map(),
  hydrateProjectsWithSubmissionData: (projects: unknown[]) => projects,
}));
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
        { id: "11111111-1111-4111-8111-111111111111", name: "Health" },
        { id: "22222222-2222-4222-8222-222222222222", name: "Climate" },
      ],
    }),
  })
);
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  // Since #892 the editor also reports the change it made.
  default: ({
    onTagsChange,
  }: {
    onTagsChange: (
      tags: string[],
      change: { added: string[]; removed: string[] }
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onTagsChange(["mate@example.com"], {
          added: ["mate@example.com"],
          removed: [],
        })
      }
    >
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

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

// The row the draft POST creates, plus its tracks. PATCH runs the real
// submission service against this, so the tests see what the server accepts.
let db: { project: Record<string, unknown>; trackIds: string[] };

const resetDb = () => {
  db = {
    project: {
      id: "project-1",
      event_id: "event-1",
      contextus_project_id: null,
      project_name: null,
      project_description: null,
      submitted: false,
    },
    trackIds: [],
  };
};

// set_project_tracks with p_replace = true: the project ends with exactly
// the requested tracks.
function mockServiceRpc(fn: string, args: unknown) {
  if (fn !== "set_project_tracks") {
    throw new Error(`Unexpected service rpc ${fn}`);
  }
  const { p_assignments, p_replace } = args as {
    p_assignments: Array<{ project_id: string; track_ids: string[] }>;
    p_replace: boolean;
  };
  if (!p_replace) throw new Error("Drafts replace their tracks");
  const assignment = p_assignments.find((a) => a.project_id === db.project.id);
  const before = db.trackIds;
  db.trackIds = assignment ? [...assignment.track_ids] : before;
  return Promise.resolve({
    data: [
      {
        added: db.trackIds.filter((id) => !before.includes(id)).length,
        removed: before.filter((id) => !db.trackIds.includes(id)).length,
      },
    ],
    error: null,
  });
}

const query = (data: unknown) => {
  const result = { data, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    single: () => chain,
    overrideTypes: async () => result,
  };
  return chain;
};

const fakeSupabase = {
  // project_team_emails: team emails are not client-readable columns.
  rpc: async () => ({ data: [], error: null }),
  from: (table: string) => {
    switch (table) {
      case "events":
        return query({ event_id: "event-1", event_name: "Demo Day" });
      case "event_submission_fields":
        return query([]);
      case "event_tracks":
        return query([{ track_id: HEALTH_TRACK }, { track_id: CLIMATE_TRACK }]);
      case "projects":
        return {
          select: () => query(db.project),
          // main reads the updated row back to detect RLS no-ops (PUB-011).
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              select: async () => {
                Object.assign(db.project, patch);
                return { data: [{ id: db.project.id }], error: null };
              },
            }),
          }),
        };
      // No "project_tracks" case: tracks are written only through the
      // service client's set_project_tracks (see mockServiceRpc), so a direct
      // write from the caller's client fails the test as an unexpected table.
      case "project_artifacts":
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  },
};

async function patchProject(body: string) {
  const parsed = normalizeProjectWriteInput(JSON.parse(body));
  if (!parsed.success) return jsonResponse({ error: "Invalid request" }, 400);
  const { status, ...result } = await saveProjectSubmission(fakeSupabase as never, {
    input: parsed.data,
    mode: "update",
    projectId: "project-1",
  });
  return jsonResponse(result, status);
}

function mockFetch(createDraft?: () => Promise<unknown>) {
  global.fetch = jest.fn((url: string, init?: FetchInit) => {
    if (url === "/api/projects" && init?.method === "POST") {
      return createDraft ? createDraft() : Promise.resolve(jsonResponse({ id: "project-1" }));
    }
    if (url === "/api/projects/project-1" && init?.method === "PATCH") {
      return patchProject(init.body as string);
    }
    return Promise.resolve(jsonResponse({ users: [], fields: [] }));
  }) as unknown as typeof fetch;
}

const callsTo = (url: string, method: string) =>
  (fetch as jest.Mock).mock.calls.filter(
    ([calledUrl, init]) => calledUrl === url && init?.method === method
  );

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

// Lets the latest PATCH settle so its outcome has reached the form.
const latestFetch = () => (fetch as jest.Mock).mock.results.at(-1)?.value;

const draftCreated = () =>
  waitFor(() => expect(callsTo("/api/projects", "POST")).toHaveLength(1));

describe("NewProjectSubmissionFormSinglePage Save draft and exit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDb();
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
    expect(db.trackIds).toEqual([HEALTH_TRACK, CLIMATE_TRACK]);
    expect(db.project.project_name).toBe("Relief Map");
    expect(toast).not.toHaveBeenCalled();
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
    expect(callsTo("/api/projects/project-1", "PATCH")).toHaveLength(1);
    expect(db.trackIds).toEqual([]);
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
    expect(db.trackIds).toEqual([HEALTH_TRACK]);
    expect(db.project.project_name).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it("exits after a track is ticked and unticked on an otherwise blank form", async () => {
    await renderForm();
    fireEvent.click(screen.getByLabelText("Health"));
    await draftCreated();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByLabelText("Health"));
    await act(async () => {
      await Promise.resolve();
    });

    await clickSaveAndExit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/events/demo-event/overview"));
    expect(db.trackIds).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
  });

  it("stays on the page when the server refuses the save", async () => {
    await renderForm();
    fireEvent.click(screen.getByLabelText("Health"));
    await draftCreated();
    await act(async () => {
      await Promise.resolve();
    });
    // A published project keeps its locked fields, so this save is rejected.
    db.project.submitted = true;

    await clickSaveAndExit();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Draft not saved",
          description: expect.stringContaining("locked fields"),
        })
      )
    );
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["a track", () => fireEvent.click(screen.getByLabelText("Health"))],
    ["a video link", () =>
      fireEvent.change(screen.getByLabelText("video_url"), {
        target: { value: "https://example.com/demo" },
      })],
    ["a teammate", () =>
      fireEvent.click(screen.getByRole("button", { name: "Add teammate" }))],
  ])("autosaves a draft holding only %s without an error", async (_label, enterInput) => {
    await renderForm();
    enterInput();
    await draftCreated();

    await waitFor(
      () => expect(callsTo("/api/projects/project-1", "PATCH")).toHaveLength(1),
      { timeout: 3000 }
    );
    await act(async () => {
      await latestFetch();
    });

    expect(toast).not.toHaveBeenCalled();
    expect(createContextusProject).not.toHaveBeenCalled();
  }, 10000);

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

    // Since #1005 the save waits for the pending draft creation instead of
    // failing, so the user is kept on the page until it settles.
    expect(push).not.toHaveBeenCalled();
  });
});
