import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectPage from "./page";
import { updateProjectClient } from "@/features/projects/client-actions/client-update";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/lib/supabase", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "in"]) {
    chain[method] = () => chain;
  }
  chain.single = async () => ({ data: null, error: null });
  chain.then = (resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 });
  return {
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "u1", email: "lead@example.com" } } },
        }),
      },
      from: () => chain,
    },
  };
});

jest.mock("@/features/projects/client-actions/client-update", () => ({
  updateProjectClient: jest.fn(),
  updateProjectTeamClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-delete", () => ({
  deleteProjectClient: jest.fn(),
}));
jest.mock("@/features/projects/client-actions/client-track-update", () => ({
  fetchEventTracks: jest.fn().mockResolvedValue({ data: [], error: null }),
}));
jest.mock("@/lib/hooks/use-admin", () => ({ useAdmin: () => false }));
jest.mock("@/features/projects/hooks/use-project-like", () => ({
  useProjectLike: () => ({
    liked: false,
    count: 0,
    isLoading: false,
    error: null,
    toggleLike: jest.fn(),
  }),
}));
jest.mock("@/features/projects/components/feedback/FeedbackDisplay", () => () => null);
jest.mock("@/features/projects/components/feedback/GiveFeedbackDialog", () => ({
  GiveFeedbackDialog: () => null,
}));
jest.mock("@/features/projects/components/tracks/TrackSelector", () => ({
  TrackSelector: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectTimeline", () => () => null);
jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectShareSection", () => ({
  ProjectShareSection: () => null,
}));
jest.mock(
  "@/features/projects/components/displays/project-dashboard/ProjectQRCodeSection",
  () => ({ ProjectQRCodeSection: () => null })
);
jest.mock("@/components/db/fileUpload", () => ({ FileUpload: () => null }));
jest.mock("@/components/db/imageUpload", () => ({ ImageUpload: () => null }));
jest.mock("@/components/utils/UserSearchWithInvite", () => () => null);
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));
jest.mock("@/components/utils", () => ({
  VideoEmbed: () => null,
  canEmbed: () => false,
}));
jest.mock("@/features/projects/components/displays/ProjectSubmissionDetails", () => ({
  ProjectSubmissionDetails: ({ project }: { project: { submission_fields?: unknown[] } }) =>
    project.submission_fields?.length ? <div>Submission Details</div> : null,
}));
jest.mock("@/components/ui/editable-field", () => ({
  EditableField: ({
    value,
    onSave,
  }: {
    value: string;
    onSave: (value: string) => Promise<boolean>;
  }) => (
    <button type="button" onClick={() => void onSave("New title")}>
      {`edit: ${value}`}
    </button>
  ),
}));

const fields = [
  { id: "name", key: "project_name", field_type: "short_text", is_active: true },
  { id: "description", key: "project_description", field_type: "long_text", is_active: true },
  { id: "url", key: "project_url", field_type: "url", is_active: true },
];

const hydratedProject = {
  id: "p1",
  project_name: "Old title",
  project_description: "Description",
  lead_name: "Lead",
  lead_email: "lead@example.com",
  teammates: [],
  project_url: "https://example.com/live",
  video_url: null,
  additional_materials_url: "",
  cover_image_url: "https://example.com/cover.png",
  event_id: null,
  submitted: true,
  tracks: [],
  track_ids: [],
  has_submission_field_config: true,
  submission_fields: fields,
  submission_answers: [
    { event_submission_field_id: "name", answer: "Old title" },
    { event_submission_field_id: "description", answer: "Description" },
    { event_submission_field_id: "url", answer: "https://example.com/live" },
  ],
  artifacts: [],
};

describe("ProjectPage inline edits", () => {
  beforeEach(() => {
    jest.mocked(updateProjectClient).mockReset();
    // The raw row an unhydrated write returns: legacy URL columns are nulled on
    // configured events and none of the submission data is present.
    jest.mocked(updateProjectClient).mockResolvedValue({
      data: {
        id: "p1",
        project_name: "New title",
        lead_email: "lead@example.com",
        project_url: null,
        cover_image_url: null,
      } as never,
      error: null,
    });
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            project: { ...hydratedProject, project_name: "New title" },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ project: hydratedProject }),
      } as Response;
    }) as typeof fetch;
  });

  it("saves through the submission API and keeps hydrated project state", async () => {
    render(<ProjectPage />);

    const editButtons = await screen.findAllByRole("button", {
      name: "edit: Old title",
    });
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/projects/p1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    const patchCall = jest
      .mocked(global.fetch)
      .mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({
      project_name: "New title",
      submission_answers: [
        { eventSubmissionFieldId: "name", answer: "New title" },
        { eventSubmissionFieldId: "description", answer: "Description" },
        { eventSubmissionFieldId: "url", answer: "https://example.com/live" },
      ],
    });
    expect(updateProjectClient).not.toHaveBeenCalled();
    expect(
      (await screen.findAllByRole("button", { name: "edit: New title" })).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Submission Details")).toBeInTheDocument();
  });
});
