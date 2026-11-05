/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  buildAnswerRows,
  createFakePostgrestClient,
  FakeTable,
} from "@/lib/projects/query.test-helpers";
import { GET } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const EVENT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "user-1";
const PROJECT_COUNT = 120;
const ANSWERS_PER_PROJECT = 9;

const projects = Array.from({ length: PROJECT_COUNT }, (_, index) => ({
  id: `project-${index}`,
  project_name: `Project ${index}`,
  lead_name: "Lead",
  lead_email: `lead-${index}@example.com`,
  teammates: [],
  event_id: EVENT_ID,
  submitted: true,
}));

const fields = Array.from({ length: ANSWERS_PER_PROJECT }, (_, index) => ({
  id: `field-${index}`,
  event_id: EVENT_ID,
  key: `custom_${index}`,
  label: `Custom ${index}`,
  field_type: "short_text",
  required: false,
  sort_order: index,
  is_active: true,
}));

function mockClient(overrides: Record<string, FakeTable> = {}) {
  const client = createFakePostgrestClient({
    user_event_roles: {
      rows: [{ event_id: EVENT_ID, user_id: USER_ID, role: "organizer" }],
    },
    projects: { rows: projects },
    event_submission_fields: { rows: fields },
    project_submission_answers: {
      rows: buildAnswerRows(PROJECT_COUNT, ANSWERS_PER_PROJECT),
    },
    project_artifacts: { rows: [] },
    events: { rows: [{ event_id: EVENT_ID, visibility: "public" }] },
    prizes: { rows: [] },
    ...overrides,
  });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    ...client,
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
    },
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(
    createFakePostgrestClient({ user_profiles: { rows: [] } }),
  );
}

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/projects?${query}`));
}

describe("GET /api/projects", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each([
    ["organizer submissions", `eventId=${EVENT_ID}`],
    ["public gallery", `public=true&eventId=${EVENT_ID}`],
  ])("%s", (_label, query) => {
    it("returns every answer for every project past the row cap", async () => {
      mockClient();

      const response = await get(query);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.projects).toHaveLength(PROJECT_COUNT);
      for (const project of body.projects) {
        for (const field of fields) {
          expect(project.submission_values[field.key]).toBe(
            `${project.id} answer ${field.sort_order}`,
          );
        }
      }
    });

    it.each(["project_submission_answers", "project_artifacts"])(
      "reports a failed %s read instead of returning blanks",
      async (table) => {
        mockClient({ [table]: { error: { message: "connection reset" } } });

        const response = await get(query);

        expect(response.status).toBe(500);
      },
    );
  });
});
