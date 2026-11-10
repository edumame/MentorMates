/** @jest-environment node */
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { queryMock, supabaseMock } from "@/lib/testing/supabase-query-mock";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("openai", () => jest.fn());

const PROJECT = "44444444-4444-4444-8444-444444444444";

function setup({ user = null as null | { id: string; user_metadata?: Record<string, unknown> }, project = { id: PROJECT, event_id: "evt-1" } as unknown, insertError = null as unknown } = {}) {
  const feedback = queryMock({ data: null, error: insertError });
  (createSupabaseClient as jest.Mock).mockResolvedValue(supabaseMock({
    user,
    tables: { projects: queryMock({ data: project, error: null }), feedback },
  }));
  return feedback;
}

const submit = (body: unknown, projectId = PROJECT) =>
  POST(new Request(`http://localhost/api/feedback/submit/${projectId}`, {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
  }), { params: Promise.resolve({ projectId }) });

describe("POST /api/feedback/submit/[projectId] (MENT-001)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("ignores client-supplied authorship, project and event for anonymous callers", async () => {
    const feedback = setup();
    const res = await submit({
      feedback_text: "Nice work",
      mentor_id: "victim-mentor",
      mentor_name: "Spoofed",
      mentor_email: "victim@example.test",
      project_id: "other-project",
      event_id: "other-event",
    });
    expect(res.status).toBe(200);
    const [rows] = feedback.insert.mock.calls[0];
    expect(rows[0]).toEqual(expect.objectContaining({
      feedback_text: "Nice work", project_id: PROJECT, event_id: "evt-1", mentor_id: null, mentor_name: null,
    }));
    expect(rows[0]).not.toHaveProperty("mentor_email");
  });

  it("attributes signed-in feedback to the caller only", async () => {
    const feedback = setup({ user: { id: "me", user_metadata: { full_name: "Me" } } });
    await submit({ feedback_text: "Nice", mentor_id: "victim-mentor" });
    expect(feedback.insert.mock.calls[0][0][0]).toEqual(expect.objectContaining({ mentor_id: "me", mentor_name: "Me" }));
  });

  it("returns 400 for invalid bodies instead of 500", async () => {
    setup();
    expect((await submit("not json")).status).toBe(400);
    expect((await submit({ feedback_text: "" })).status).toBe(400);
  });

  it("returns 404 when the project is not visible", async () => {
    setup({ project: null });
    expect((await submit({ feedback_text: "Hi" })).status).toBe(404);
  });

  it("maps an RLS refusal to 403", async () => {
    setup({ insertError: { code: "42501" } });
    expect((await submit({ feedback_text: "Hi" })).status).toBe(403);
  });

  it("rejects malformed project ids", async () => {
    setup();
    expect((await submit({ feedback_text: "Hi" }, "nope")).status).toBe(400);
  });
});
