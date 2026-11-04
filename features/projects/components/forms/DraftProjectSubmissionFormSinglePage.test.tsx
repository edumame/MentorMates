import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DraftProjectSubmissionFormSinglePage from "./DraftProjectSubmissionFormSinglePage";
import type { EventSubmissionField, Project } from "@/lib/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    then: (resolve: (result: { data: []; error: null }) => void) =>
      resolve({ data: [], error: null }),
  };
  return { supabase: { from: () => query } };
});
jest.mock("@/components/utils/UserSearchWithInvite", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/projects/ProjectDescription", () => ({
  ProjectDescription: () => null,
}));
jest.mock("@/features/intake-forms/components/ParticipantIntakeDialog", () => ({
  ParticipantIntakeDialog: () => null,
}));
jest.mock("@/features/projects/components/displays/ProjectFieldEntriesSection", () => ({
  ProjectFieldEntriesSection: jest.requireActual("react").forwardRef(() => null),
}));
jest.mock("@mui/icons-material", () => ({ TextFields: () => null }));

const MATERIALS = [
  "https://example.com/one",
  "https://example.com/two",
  "https://example.com/three",
];

const buildField = (
  id: string,
  key: string,
  field_type: EventSubmissionField["field_type"]
): EventSubmissionField => ({
  id,
  event_id: "event-1",
  key,
  label: key,
  field_type,
  required: false,
  sort_order: 0,
  is_active: true,
});

const nameField = buildField("field-name", "project_name", "short_text");
const materialsField = buildField(
  "field-materials",
  "additional_materials",
  "multi_url"
);

const buildProject = (
  fields: EventSubmissionField[] = [nameField, materialsField]
): Project =>
  ({
    id: "project-1",
    event_id: "event-1",
    project_name: "Demo",
    project_description: "",
    project_url: "",
    additional_materials_url: MATERIALS[0],
    lead_email: "lead@example.test",
    teammates: [],
    has_submission_field_config: true,
    submission_fields: fields,
    submission_values: { project_name: "Demo", additional_materials: MATERIALS },
    submission_answers: [
      { event_submission_field_id: nameField.id, answer: "Demo" },
      { event_submission_field_id: materialsField.id, answer: MATERIALS },
    ],
  }) as unknown as Project;

let patchBodies: Array<Record<string, unknown>>;

const materialsAnswers = () =>
  patchBodies.map((body) =>
    (
      body.submission_answers as Array<{
        eventSubmissionFieldId: string;
        answer: string | string[];
      }>
    ).find((answer) => answer.eventSubmissionFieldId === materialsField.id)?.answer
  );

const renderForm = async (project = buildProject()) => {
  render(
    <DraftProjectSubmissionFormSinglePage
      projectId="project-1"
      session={null}
      project={project}
      canEdit
    />
  );
  // Let the mount-time event, track and field-config fetches settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  patchBodies = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      patchBodies.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/submission-fields")) {
      return {
        ok: true,
        json: async () => ({ fields: buildProject().submission_fields }),
      };
    }
    return { ok: true, json: async () => ({ users: [], form: null }) };
  }) as unknown as typeof fetch;
});

describe("DraftProjectSubmissionFormSinglePage additional materials", () => {
  it("loads every saved item on a configured event", async () => {
    await renderForm();

    for (const url of MATERIALS) {
      expect(screen.getByDisplayValue(url)).toBeInTheDocument();
    }
  });

  it("keeps every saved item when publishing an unedited form", async () => {
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Publish project" }));

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(materialsAnswers()).toEqual([MATERIALS]);
  });

  it("keeps every saved item when autosaving an unrelated edit", async () => {
    await renderForm();

    fireEvent.change(screen.getByDisplayValue("Demo"), {
      target: { value: "Renamed" },
    });

    await waitFor(() => expect(patchBodies).toHaveLength(1), { timeout: 3000 });
    expect(materialsAnswers()).toEqual([MATERIALS]);
  });

  it("drops only the item the submitter edits away", async () => {
    await renderForm();

    fireEvent.change(screen.getByDisplayValue(MATERIALS[1]), {
      target: { value: "" },
    });

    await waitFor(() => expect(patchBodies).toHaveLength(1), { timeout: 3000 });
    expect(materialsAnswers()).toEqual([[MATERIALS[0], MATERIALS[2]]]);
  });

  it("writes nothing when the form only loads", async () => {
    await renderForm();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(patchBodies).toHaveLength(0);
  });
});
