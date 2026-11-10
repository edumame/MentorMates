import { act, fireEvent, render, screen } from "@testing-library/react";
import DraftProjectSubmissionFormSinglePage from "./DraftProjectSubmissionFormSinglePage";
import { updateProjectTeamClient } from "@/features/projects/client-actions/client-update";
import type { Project } from "@/lib/types";
import type { Session } from "@supabase/supabase-js";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectClient: jest.fn(),
  updateProjectTeamClient: jest.fn(),
}));
jest.mock("@/lib/supabase", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "gte", "lte"]) {
    chain[method] = () => chain;
  }
  chain.single = async () => ({ data: null, error: null });
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = (resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null });
  return { supabase: { from: () => chain } };
});
jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));
jest.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
jest.mock("@/features/intake-forms/components/ParticipantIntakeDialog", () => ({
  ParticipantIntakeDialog: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: jest.requireActual("react").forwardRef(() => null),
}));
jest.mock(
  "@/features/projects/components/forms/components/ProjectSubmissionSchemaSection",
  () => ({ ProjectSubmissionSchemaSection: () => null }),
);
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  // Mirrors the real widget: its list is seeded at mount and never refreshed.
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
          onTagsChange(["a@x.com", "c@x.com"], { added: ["c@x.com"], removed: [] })
        }
      >
        add c
      </button>
      <button
        onClick={() =>
          onTagsChange(["a@x.com", "lead@x.com"], {
            added: ["LEAD@x.com"],
            removed: [],
          })
        }
      >
        add lead
      </button>
      <button
        onClick={() => onTagsChange([], { added: [], removed: ["a@x.com"] })}
      >
        drop a
      </button>
    </>
  ),
}));

const project = {
  id: "p1",
  project_name: "Project",
  project_description: "Description",
  lead_name: "Lead",
  lead_email: "lead@x.com",
  teammates: ["a@x.com"],
  event_id: null,
} as unknown as Project;

describe("DraftProjectSubmissionFormSinglePage team writes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateProjectTeamClient as jest.Mock).mockResolvedValue({
      data: project,
      error: null,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ fields: [] }),
    })) as unknown as typeof fetch;
  });

  async function clickWidget(name: string) {
    render(
      <DraftProjectSubmissionFormSinglePage
        projectId="p1"
        session={{ user: { email: "lead@x.com" } } as Session}
        project={project}
        canEdit
      />,
    );
    const button = await screen.findByRole("button", { name });
    await act(async () => {
      fireEvent.click(button);
    });
  }

  it("sends only the added email, not the list seeded at mount", async () => {
    await clickWidget("add c");

    expect(updateProjectTeamClient).toHaveBeenCalledWith("p1", {
      add: ["c@x.com"],
      remove: [],
    });
  });

  it("sends only the removed email", async () => {
    await clickWidget("drop a");

    expect(updateProjectTeamClient).toHaveBeenCalledWith("p1", {
      add: [],
      remove: ["a@x.com"],
    });
  });

  it("does not add the lead as a teammate", async () => {
    await clickWidget("add lead");

    expect(updateProjectTeamClient).not.toHaveBeenCalled();
  });

  it("sends only the email removed from the team list", async () => {
    await clickWidget("add c");
    (updateProjectTeamClient as jest.Mock).mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    });

    expect(updateProjectTeamClient).toHaveBeenCalledWith("p1", {
      remove: ["a@x.com"],
    });
  });
});
