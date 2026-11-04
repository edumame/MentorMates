/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private readonly body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const URL_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const VICTIM_ID = "55555555-5555-4555-8555-555555555555";
const SIGNED_IN_ID = "66666666-6666-4666-8666-666666666666";

const SIGNED_IN_USER = {
  id: SIGNED_IN_ID,
  email: "mentor@example.com",
  user_metadata: { full_name: "Real Mentor" },
};

const FORGED_FIELDS = {
  mentor_id: VICTIM_ID,
  mentor_name: "Head Judge",
  mentor_email: "x@y.test",
};

function setup({
  user = null,
  project = { id: URL_PROJECT_ID, event_id: PROJECT_EVENT_ID },
  projectError = null,
  insertError = null,
}: {
  user?: typeof SIGNED_IN_USER | null;
  project?: { id: string; event_id: string | null } | null;
  projectError?: { message: string } | null;
  insertError?: { message: string } | null;
} = {}) {
  const projectEq = jest.fn(() => ({
    single: jest.fn().mockResolvedValue({ data: project, error: projectError }),
  }));
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  const from = jest.fn((table: string) => {
    if (table === "projects") {
      return { select: jest.fn(() => ({ eq: projectEq })) };
    }
    if (table === "feedback") return { insert };
    throw new Error(`Unexpected table ${table}`);
  });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from,
  });

  return { insert, projectEq };
}

function post(body: unknown, projectId = URL_PROJECT_ID) {
  return POST(
    new Request(`http://localhost/api/feedback/submit/${projectId}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ projectId }) }
  );
}

function insertedRow(insert: jest.Mock) {
  expect(insert).toHaveBeenCalledTimes(1);
  return insert.mock.calls[0][0][0];
}

describe("POST /api/feedback/submit/[projectId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("drops a client-supplied sender on anonymous submissions", async () => {
    const { insert } = setup();

    const response = await post({
      project_id: URL_PROJECT_ID,
      feedback_text: "Nice demo",
      ...FORGED_FIELDS,
    });

    expect(response.status).toBe(200);
    expect(insertedRow(insert)).toMatchObject({
      mentor_id: null,
      mentor_name: null,
      mentor_email: null,
    });
  });

  it("takes the sender from the session for signed-in submissions", async () => {
    const { insert } = setup({ user: SIGNED_IN_USER });

    await post({ feedback_text: "Nice demo", ...FORGED_FIELDS });

    expect(insertedRow(insert)).toMatchObject({
      mentor_id: SIGNED_IN_ID,
      mentor_name: "Real Mentor",
      mentor_email: "mentor@example.com",
    });
  });

  it("writes the URL project, not the project id in the body", async () => {
    const { insert, projectEq } = setup({ user: SIGNED_IN_USER });

    await post({ project_id: OTHER_PROJECT_ID, feedback_text: "Nice demo" });

    expect(projectEq).toHaveBeenCalledWith("id", URL_PROJECT_ID);
    expect(insertedRow(insert).project_id).toBe(URL_PROJECT_ID);
  });

  it("writes the project's event, ignoring the event id in the body", async () => {
    const { insert } = setup({ user: SIGNED_IN_USER });

    await post({ event_id: OTHER_EVENT_ID, feedback_text: "Nice demo" });
    expect(insertedRow(insert).event_id).toBe(PROJECT_EVENT_ID);

    insert.mockClear();
    await post({ event_id: null, feedback_text: "Nice demo" });
    expect(insertedRow(insert).event_id).toBe(PROJECT_EVENT_ID);
  });

  it("writes a null event for a project that has no event", async () => {
    const { insert } = setup({
      project: { id: URL_PROJECT_ID, event_id: null },
    });

    await post({ event_id: OTHER_EVENT_ID, feedback_text: "Nice demo" });

    expect(insertedRow(insert).event_id).toBeNull();
  });

  it("writes only whitelisted columns", async () => {
    const { insert } = setup();

    await post({
      id: "77777777-7777-4777-8777-777777777777",
      created_at: "2000-01-01T00:00:00Z",
      unknown_column: "nope",
      feedback_text: "Polished text",
      original_feedback_text: "Rough text",
      modifier_field: ["ai_enhanced"],
      specific_ai_suggestion: "specific",
      positive_ai_suggestion: "positive",
      actionable_ai_suggestion: "actionable",
    });

    expect(insertedRow(insert)).toEqual({
      project_id: URL_PROJECT_ID,
      event_id: PROJECT_EVENT_ID,
      mentor_id: null,
      mentor_name: null,
      mentor_email: null,
      feedback_text: "Polished text",
      original_feedback_text: "Rough text",
      modifier_field: ["ai_enhanced"],
      specific_ai_suggestion: "specific",
      positive_ai_suggestion: "positive",
      actionable_ai_suggestion: "actionable",
    });
  });

  it("stores null for optional fields of the wrong type", async () => {
    const { insert } = setup();

    await post({
      feedback_text: "Nice demo",
      original_feedback_text: { nested: true },
      modifier_field: "ai_enhanced",
      specific_ai_suggestion: 1,
    });

    expect(insertedRow(insert)).toMatchObject({
      original_feedback_text: null,
      modifier_field: null,
      specific_ai_suggestion: null,
      positive_ai_suggestion: null,
      actionable_ai_suggestion: null,
    });
  });

  it.each([
    ["missing", {}],
    ["blank", { feedback_text: "   " }],
    ["not a string", { feedback_text: { nested: true } }],
  ])("rejects %s feedback text", async (_label, body) => {
    const { insert } = setup();

    const response = await post(body);

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a JSON null", "null"],
    ["a JSON array", "[]"],
  ])("rejects %s as the body", async (_label, body) => {
    const { insert } = setup();

    const response = await post(body);

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 404 without inserting when the project is not visible", async () => {
    const { insert } = setup({
      project: null,
      projectError: { message: "no rows" },
    });

    const response = await post({ feedback_text: "Nice demo" });

    expect(response.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 500 when the insert is rejected", async () => {
    setup({ insertError: { message: "denied by RLS" } });

    const response = await post({ feedback_text: "Nice demo" });

    expect(response.status).toBe(500);
  });
});
