import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewProjectSubmissionFormSinglePage } from "./NewProjectSubmissionFormSinglePage";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
    }),
  },
}));
jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
jest.mock("@/components/events/event-card", () => ({ EventCard: () => null }));
jest.mock(
  "@/features/projects/components/forms/hooks/useProjectSubmissionData",
  () => ({ useProjectSubmissionData: () => ({ availableTracks: [] }) }),
);
jest.mock("@/features/intake-forms/components/ParticipantIntakeDialog", () => ({
  ParticipantIntakeDialog: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: jest.requireActual("react").forwardRef(() => null),
}));
jest.mock(
  "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection",
  () => ({
    ProjectSubmissionSchemaSection: ({
      onValueChange,
    }: {
      onValueChange: (key: string, value: string) => void;
    }) => (
      <>
        <input
          aria-label="name"
          onChange={(e) => onValueChange("project_name", e.target.value)}
        />
        <input
          aria-label="description"
          onChange={(e) => onValueChange("project_description", e.target.value)}
        />
      </>
    ),
  }),
);
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  default: ({
    onTagsChange,
  }: {
    onTagsChange: (
      tags: string[],
      change: { added: string[]; removed: string[] },
    ) => void;
  }) => (
    <>
      <button
        onClick={() =>
          onTagsChange(["Pat (pat@x.com)"], { added: ["pat@x.com"], removed: [] })
        }
      >
        add pat
      </button>
      <button
        onClick={() =>
          onTagsChange(["Pat (pat@x.com)", "Sam (sam@x.com)"], {
            added: ["sam@x.com"],
            removed: [],
          })
        }
      >
        add sam
      </button>
      <button
        onClick={() =>
          onTagsChange(["Sam (sam@x.com)"], { added: [], removed: ["pat@x.com"] })
        }
      >
        remove pat
      </button>
      <button
        onClick={() => onTagsChange([], { added: [], removed: ["sam@x.com"] })}
      >
        remove sam
      </button>
    </>
  ),
}));

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function bodiesFor(url: string, method: string) {
  return (fetch as jest.Mock).mock.calls
    .filter(([calledUrl, init]) => calledUrl === url && init?.method === method)
    .map(([, init]) => JSON.parse(init.body));
}

async function renderWithDraft() {
  render(
    <NewProjectSubmissionFormSinglePage
      userEmail="lead@x.com"
      leadName="Lead"
      eventId="e1"
    />,
  );
  const nameInput = await screen.findByLabelText("name");
  await act(async () => {
    fireEvent.change(nameInput, { target: { value: "Project" } });
    fireEvent.change(screen.getByLabelText("description"), {
      target: { value: "Description" },
    });
  });
  await waitFor(() =>
    expect(bodiesFor("/api/projects", "POST")).toHaveLength(1),
  );
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function editDescription(value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("description"), {
      target: { value },
    });
  });
}

const patches = () => bodiesFor("/api/projects/p1", "PATCH");

async function waitForPatch(matches: (body: Record<string, unknown>) => boolean) {
  await waitFor(() => expect(patches().some(matches)).toBe(true), {
    timeout: 3000,
  });
}

const removes =
  (email: string) =>
  (body: Record<string, unknown>) =>
    (body.removeTeammates as string[]).includes(email);

async function publish() {
  await act(async () => {
    fireEvent.click(
      screen.getAllByRole("button", { name: "Publish project" })[0],
    );
  });
  await waitFor(() =>
    expect(bodiesFor("/api/projects/submit", "POST")).toHaveLength(1),
  );
}

describe("NewProjectSubmissionFormSinglePage team writes", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url: string) => {
      if (url === "/api/projects") return json({ id: "p1" });
      if (url === "/api/projects/p1") return json({ project: { id: "p1" } });
      if (url === "/api/projects/submit") return json({ data: { id: "p1" } });
      if (url.includes("/users")) {
        return json({
          users: [
            { user_id: "u1", display_name: "Pat", email: "pat@x.com" },
            { user_id: "u2", display_name: "Sam", email: "sam@x.com" },
          ],
        });
      }
      if (url.includes("/intake-form")) return json({ form: null });
      return json({ fields: [] });
    }) as unknown as typeof fetch;
  });

  it("never sends a whole team list that would overwrite joined teammates", async () => {
    await renderWithDraft();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "add pat" }));
    });

    await publish();

    const [saved] = bodiesFor("/api/projects/p1", "PATCH");
    const [submitted] = bodiesFor("/api/projects/submit", "POST");
    expect(saved).not.toHaveProperty("teammates");
    expect(submitted).not.toHaveProperty("teammates");
    expect(saved.addTeammates).toEqual(["pat@x.com"]);
    expect(submitted.addTeammates).toEqual(["pat@x.com"]);
  });

  describe("removals", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("sends a teammate the lead removed in the save that follows", async () => {
      await renderWithDraft();
      await click("add pat");
      await click("add sam");
      await click("remove pat");

      await waitForPatch(removes("pat@x.com"));

      const saved = patches().find(removes("pat@x.com"));
      expect(saved.addTeammates).toEqual(["sam@x.com"]);
      expect(saved.removeTeammates).toEqual(["pat@x.com"]);
    });

    it("applies a removal once, so it cannot delete someone who joins later", async () => {
      await renderWithDraft();
      await click("add pat");
      await click("remove pat");
      await waitForPatch(removes("pat@x.com"));
      const savesWithRemoval = patches().filter(removes("pat@x.com")).length;

      await editDescription("Edited after the removal was saved");
      await waitForPatch(
        (body) => body.project_description === "Edited after the removal was saved",
      );
      await editDescription("Edited again before publishing");
      await publish();

      expect(patches().filter(removes("pat@x.com"))).toHaveLength(savesWithRemoval);
      expect(savesWithRemoval).toBe(1);
      const [submitted] = bodiesFor("/api/projects/submit", "POST");
      expect(submitted).not.toHaveProperty("removeTeammates");
    });

    it("saves a removal before publishing and does not repeat it in the submit", async () => {
      await renderWithDraft();
      await click("add pat");
      await click("remove pat");

      await publish();

      expect(patches().filter(removes("pat@x.com"))).toHaveLength(1);
      const [submitted] = bodiesFor("/api/projects/submit", "POST");
      expect(submitted).not.toHaveProperty("removeTeammates");
    });

    it("keeps a removal made while an earlier save was in flight", async () => {
      await renderWithDraft();
      await click("add pat");
      await click("add sam");

      const mockFetch = fetch as jest.Mock;
      const respond = mockFetch.getMockImplementation()!;
      let finishSave!: () => void;
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === "/api/projects/p1" && removes("pat@x.com")(JSON.parse(String(init?.body)))) {
          await new Promise<void>((resolve) => {
            finishSave = resolve;
          });
        }
        return respond(url, init);
      });

      await click("remove pat");
      await waitForPatch(removes("pat@x.com"));
      await click("remove sam");
      await act(async () => {
        finishSave();
      });

      await waitForPatch(removes("sam@x.com"));
      const saved = patches().find(removes("sam@x.com"));
      expect(saved.removeTeammates).toEqual(["sam@x.com"]);
    });

    it("keeps a removal until a save carrying it succeeds", async () => {
      await renderWithDraft();
      await click("add pat");

      const mockFetch = fetch as jest.Mock;
      const respond = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === "/api/projects/p1" && removes("pat@x.com")(JSON.parse(String(init?.body)))) {
          mockFetch.mockImplementation(respond);
          return { ok: false, status: 500, json: async () => ({ error: "Failed" }) };
        }
        return respond(url, init);
      });

      await click("remove pat");
      await waitForPatch(removes("pat@x.com"));
      await editDescription("Edited after the failed save");

      await waitForPatch(
        (body) =>
          body.project_description === "Edited after the failed save" &&
          removes("pat@x.com")(body),
      );
    });
  });

  it("stops removing a teammate the lead adds back", async () => {
    await renderWithDraft();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "add pat" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "remove pat" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "add pat" }));
    });

    await publish();

    const [submitted] = bodiesFor("/api/projects/submit", "POST");
    expect(submitted.addTeammates).toEqual(["pat@x.com"]);
    expect(patches().at(-1).removeTeammates).toEqual([]);
  });
});
