/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

const eventId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const projectUrlFieldId = "33333333-3333-4333-8333-333333333333";
const coverFieldId = "44444444-4444-4444-8444-444444444444";
const customFieldId = "55555555-5555-4555-8555-555555555555";
const userId = "66666666-6666-4666-8666-666666666666";

function field(id: string, key: string, field_type: string, sort_order: number) {
  return {
    id,
    event_id: eventId,
    key,
    label: key,
    description: null,
    placeholder: null,
    field_type,
    required: false,
    sort_order,
    is_active: true,
    options: [],
    max_files: null,
    allows_multiple_entries: false,
  };
}

const configuredFields = [
  field(projectUrlFieldId, "project_url", "url", 0),
  field(coverFieldId, "cover_image", "file", 1),
  field(customFieldId, "inspiration", "long_text", 2),
];

const answers = [
  {
    id: "a1",
    project_id: projectId,
    event_submission_field_id: projectUrlFieldId,
    answer: "https://example.com/demo",
  },
  {
    id: "a2",
    project_id: projectId,
    event_submission_field_id: coverFieldId,
    answer: "https://example.com/cover.png",
  },
  {
    id: "a3",
    project_id: projectId,
    event_submission_field_id: customFieldId,
    answer: "Our users asked for it",
  },
];

// A project saved under a configured form: the legacy columns were reset, so
// the content lives only in project_submission_answers.
const projectRow = {
  id: projectId,
  project_name: "Demo",
  lead_name: "Lead",
  lead_email: "lead@example.com",
  project_description: "Description",
  teammates: [],
  project_url: null,
  video_url: null,
  additional_materials_url: null,
  cover_image_url: null,
  event_id: eventId,
  contextus_project_id: null,
  private: false,
  created_at: "2026-07-31T00:00:00Z",
  submitted: true,
  project_tracks: [],
};

type Rows = Record<string, unknown[]>;

// Chainable stand-in for a Supabase query: filters are ignored and each table
// resolves to the rows the test gives it, which is how RLS is modelled here.
function buildClient(rows: Rows, user: { id: string } | null = null) {
  const from = jest.fn((table: string) => {
    const tableRows = rows[table] ?? [];
    const result = { data: tableRows, error: null };
    const single = { data: tableRows[0] ?? null, error: null };
    const query: Record<string, unknown> = {
      then: (
        resolve: (value: typeof result) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject),
      maybeSingle: () => query.__single,
      single: () => query.__single,
      __single: {
        overrideTypes: () => Promise.resolve(single),
        then: (
          resolve: (value: typeof single) => unknown,
          reject: (reason: unknown) => unknown
        ) => Promise.resolve(single).then(resolve, reject),
      },
    };
    for (const method of ["select", "eq", "in", "order", "limit", "overrideTypes"]) {
      query[method] = () => query;
    }
    return query;
  });

  return {
    from,
    // Membership and team emails go through SECURITY DEFINER RPCs
    // (my_project_ids, project_team_emails); a non-member gets no rows.
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

// What RLS returns to a viewer with no role in the event: the project and its
// answers, but no field definitions.
const nonMemberRows: Rows = {
  projects: [projectRow],
  events: [{ visibility: "public" }],
  project_submission_answers: answers,
  event_submission_fields: [],
};

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/projects?${query}`));
}

function expectConfiguredContent(project: Record<string, unknown>) {
  expect(project.has_submission_field_config).toBe(true);
  expect(project.project_url).toBe("https://example.com/demo");
  expect(project.cover_image_url).toBe("https://example.com/cover.png");
  expect(project.submission_values).toMatchObject({
    inspiration: "Our users asked for it",
  });
  expect(project.artifacts).toEqual([
    expect.objectContaining({
      kind: "project_link",
      url: "https://example.com/demo",
    }),
  ]);
}

function fieldReads(client: ReturnType<typeof buildClient>) {
  return client.from.mock.calls.filter(
    ([table]) => table === "event_submission_fields"
  ).length;
}

describe("GET /api/projects submission field visibility", () => {
  let serviceClient: ReturnType<typeof buildClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceClient = buildClient({ event_submission_fields: configuredFields });
    mockCreateServiceClient.mockReturnValue(serviceClient);
  });

  it("shows configured content in the public gallery to a logged-out viewer", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildClient(nonMemberRows));

    const response = await get(`public=true&eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.projects[0]);
  });

  it("shows configured content on the public single-project read", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildClient(nonMemberRows));

    const response = await get(`public=true&projectId=${projectId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.project);
  });

  it("shows configured content to a logged-in viewer with no event role", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient(nonMemberRows, { id: userId })
    );

    const response = await get(`projectId=${projectId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.project);
  });

  it("shows configured content in the event list to a viewer with no event role", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient(nonMemberRows, { id: userId })
    );

    const response = await get(`eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.projects[0]);
  });

  it("falls back to the caller's client when the service key is missing", async () => {
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error("supabaseKey is required.");
    });
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient({ ...nonMemberRows, event_submission_fields: configuredFields })
    );

    const response = await get(`public=true&eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.projects[0]);
  });

  it("falls back to the caller's client when the service read returns nothing", async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({}));
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient({ ...nonMemberRows, event_submission_fields: configuredFields })
    );

    const response = await get(`public=true&eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expectConfiguredContent(body.projects[0]);
  });

  it("keeps the default fields for an event with no configured form", async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({}));
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient({
        ...nonMemberRows,
        projects: [{ ...projectRow, project_url: "https://example.com/legacy" }],
        project_submission_answers: [],
      })
    );

    const response = await get(`public=true&eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projects[0].has_submission_field_config).toBe(false);
    expect(body.projects[0].project_url).toBe("https://example.com/legacy");
  });

  it("does not read field definitions for an event that is not public", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient({ ...nonMemberRows, events: [{ visibility: "private" }] })
    );

    const response = await get(`public=true&eventId=${eventId}`);

    expect(response.status).toBe(404);
    expect(fieldReads(serviceClient)).toBe(0);
  });

  it("does not read field definitions for a project the viewer cannot see", async () => {
    const callerClient = buildClient(
      { ...nonMemberRows, events: [{ visibility: "private" }] },
      { id: userId }
    );
    mockCreateSupabaseClient.mockResolvedValue(callerClient);

    const response = await get(`public=true&projectId=${projectId}`);

    expect(response.status).toBe(404);
    expect(fieldReads(serviceClient)).toBe(0);
  });

  it("returns no field definitions in an event list with no visible projects", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildClient({ ...nonMemberRows, projects: [] }, { id: userId })
    );

    const response = await get(`eventId=${eventId}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projects).toEqual([]);
  });
});
