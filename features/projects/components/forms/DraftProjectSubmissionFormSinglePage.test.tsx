import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import type { Project } from "@/lib/types";
import DraftProjectSubmissionFormSinglePage from "./DraftProjectSubmissionFormSinglePage";

const PROJECT_ID = "project-1";
const LEAD = "lead@example.com";
const TEAMMATE = "teammate@example.com";
const PARTICIPANT = "participant@example.com";
const OTHER_PARTICIPANT = "other@example.com";
const INVITEE = "invitee@example.com";

// In-memory projects row. The form's real client actions run against it.
const mockDb = {
  teammates: [] as string[],
  writes: [] as string[][],
  failNextRead: false,
  readDelayMs: 0,
};

const mockToast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock(
  "@/features/projects/components/forms/hooks/useProjectSubmissionAutosave",
  () => ({
    useProjectSubmissionAutosave: () => ({
      lastSaved: null,
      flushSave: jest.fn(),
    }),
  })
);

jest.mock(
  "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection",
  () => ({ ProjectSubmissionSchemaSection: () => null })
);

jest.mock(
  "@/features/projects/components/displays/ProjectFieldEntriesSection",
  () => ({ ProjectFieldEntriesSection: () => null })
);

jest.mock("@/lib/supabase", () => {
  const projectRow = () => ({
    project_id: "project-1",
    lead_email: "lead@example.com",
    teammates: mockDb.teammates,
  });

  const projectsQuery = () => {
    let pendingTeammates: string[] | null = null;
    const query = {
      select: () => query,
      eq: () => query,
      update: ({ teammates }: { teammates: string[] }) => {
        pendingTeammates = teammates;
        return query;
      },
      single: async () => {
        if (pendingTeammates) {
          mockDb.teammates = pendingTeammates;
          mockDb.writes.push(pendingTeammates);
          return { data: projectRow(), error: null };
        }

        const teammates = mockDb.teammates;
        if (mockDb.readDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, mockDb.readDelayMs)
          );
        }
        if (mockDb.failNextRead) {
          mockDb.failNextRead = false;
          return { data: null, error: { message: "read failed" } };
        }
        return { data: { teammates }, error: null };
      },
    };
    return query;
  };

  const emptyQuery = () => {
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) =>
        resolve({ data: [], error: null }),
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
    };
    ["select", "eq", "in", "order", "limit"].forEach((method) => {
      query[method] = () => query;
    });
    return query;
  };

  return {
    supabase: {
      from: (table: string) =>
        table === "projects" ? projectsQuery() : emptyQuery(),
    },
  };
});

const project = {
  project_id: PROJECT_ID,
  event_id: "event-1",
  project_name: "Test project",
  lead_name: "Lead",
  lead_email: LEAD,
  teammates: [TEAMMATE],
  submission_answers: [],
} as unknown as Project;

const session = {
  user: { id: "user-1", email: LEAD },
} as unknown as Session;

const mockFetch = () => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const payload = String(input).includes("/users")
      ? {
          users: [PARTICIPANT, OTHER_PARTICIPANT, TEAMMATE].map((email) => ({
            user_id: email,
            display_name: email,
            email,
          })),
        }
      : { success: true };
    return { ok: true, json: async () => payload };
  }) as unknown as typeof fetch;
};

const renderForm = async () => {
  render(
    <DraftProjectSubmissionFormSinglePage
      projectId={PROJECT_ID}
      session={session}
      project={project}
      canEdit
    />
  );
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/events/event-1/users")
    )
  );
};

const searchInput = () =>
  screen.getByPlaceholderText(/Enter your teammates' emails/);

const typeInSearch = (value: string) =>
  fireEvent.change(searchInput(), { target: { value } });

const invite = async (email: string) => {
  typeInSearch(email);
  fireEvent.click(await screen.findByText("Send project invitation"));
  await screen.findByText("Invited");
};

const addParticipant = async (email: string) => {
  typeInSearch(email);
  const dropdown = await waitFor(() => {
    const list = document.getElementById("dropdown");
    expect(list).not.toBeNull();
    return list as HTMLElement;
  });
  fireEvent.click(within(dropdown).getByText(email));
};

const removeChip = (email: string) => {
  const chip = within(document.getElementById("tagList") as HTMLElement)
    .getByText(email)
    .closest("span") as HTMLElement;
  fireEvent.click(chip.querySelector("button") as HTMLButtonElement);
};

const removeFromTeamList = () => {
  const chips = document.getElementById("tagList") as HTMLElement;
  const teamListRemove = screen
    .getAllByRole("button", { name: "Remove" })
    .find((button) => !chips.contains(button)) as HTMLElement;
  fireEvent.click(teamListRemove);
};

// What /api/projects/join does when the invitee accepts.
const acceptInvite = (email: string) => {
  mockDb.teammates = [...mockDb.teammates, email];
};

describe("DraftProjectSubmissionFormSinglePage team changes", () => {
  beforeEach(() => {
    mockDb.teammates = [TEAMMATE];
    mockDb.writes = [];
    mockDb.failNextRead = false;
    mockDb.readDelayMs = 0;
    mockToast.mockClear();
    mockFetch();
  });

  it("does not add an invited email to the team", async () => {
    await renderForm();

    await invite(INVITEE);

    expect(mockDb.writes).toEqual([]);
    expect(mockDb.teammates).toEqual([TEAMMATE]);
  });

  it("does not add a pending invite when another teammate is added", async () => {
    await renderForm();
    await invite(INVITEE);

    await addParticipant(PARTICIPANT);

    await waitFor(() =>
      expect(mockDb.teammates).toEqual([TEAMMATE, PARTICIPANT])
    );
  });

  it("keeps an invitee who accepted when another teammate is added", async () => {
    await renderForm();
    await invite(INVITEE);
    acceptInvite(INVITEE);

    await addParticipant(PARTICIPANT);

    await waitFor(() =>
      expect(mockDb.teammates).toEqual([TEAMMATE, INVITEE, PARTICIPANT])
    );
  });

  it("keeps an invitee who accepted when a teammate chip is removed", async () => {
    await renderForm();
    await invite(INVITEE);
    acceptInvite(INVITEE);

    removeChip(TEAMMATE);

    await waitFor(() => expect(mockDb.teammates).toEqual([INVITEE]));
  });

  it("keeps an invitee who accepted when a teammate is removed from the team list", async () => {
    await renderForm();
    await invite(INVITEE);
    acceptInvite(INVITEE);

    removeFromTeamList();

    await waitFor(() => expect(mockDb.teammates).toEqual([INVITEE]));
  });

  it("saves both teammates when two are added in quick succession", async () => {
    mockDb.readDelayMs = 100;
    await renderForm();

    await addParticipant(PARTICIPANT);
    await addParticipant(OTHER_PARTICIPANT);

    await waitFor(() =>
      expect(mockDb.teammates).toEqual([
        TEAMMATE,
        PARTICIPANT,
        OTHER_PARTICIPANT,
      ])
    );
  });

  it("applies overlapping team changes one after the other", async () => {
    mockDb.readDelayMs = 100;
    await renderForm();

    removeFromTeamList();
    await addParticipant(PARTICIPANT);

    await waitFor(() => expect(mockDb.writes).toHaveLength(2));
    expect(mockDb.teammates).toEqual([PARTICIPANT]);
  });

  it("writes nothing when the team cannot be read, then retries with the next change", async () => {
    await renderForm();
    mockDb.failNextRead = true;

    await addParticipant(PARTICIPANT);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to update team members",
        })
      )
    );
    expect(mockDb.writes).toEqual([]);

    await addParticipant(OTHER_PARTICIPANT);

    await waitFor(() =>
      expect(mockDb.teammates).toEqual([
        TEAMMATE,
        PARTICIPANT,
        OTHER_PARTICIPANT,
      ])
    );
  });
});
