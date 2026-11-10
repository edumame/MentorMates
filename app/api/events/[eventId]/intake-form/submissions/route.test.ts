/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getAuthContext } from "../../intake-forms/_shared";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("../../intake-forms/_shared", () => ({ getAuthContext: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));

const VERSION = "11111111-1111-4111-8111-111111111111";
const OTHER_VERSION = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const schema = {
  title: "Registration",
  fields: [
    { id: "1", key: "name", type: "short_text", label: "Name", required: true },
    { id: "2", key: "coc", type: "checkbox", label: "CoC", required: true },
  ],
};
const surveySchema = {
  title: "Survey",
  fields: [
    { id: "a", key: "attending", type: "single_select", label: "Attending", required: false, options: ["Yes", "No"] },
    { id: "d", key: "dietary", type: "short_text", label: "Dietary", required: false },
    { id: "r", key: "rating", type: "single_select", label: "Rating", required: false, options: ["1", "2", "3", "4", "5"] },
    { id: "c", key: "comments", type: "long_text", label: "Comments", required: false },
  ],
};

function builder(result: unknown) {
  const b: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "is", "order", "limit"]) b[m] = jest.fn(() => b);
  b.maybeSingle = jest.fn().mockResolvedValue(result);
  return b;
}

function setup({
  user = { id: "user-1", email: "u@example.test" } as { id: string; email: string } | null,
  binding = { form_version_id: VERSION } as { form_version_id: string } | null,
  formSchema = schema as unknown,
  hasRole = true,
  visibility = "public",
  project = { id: PROJECT_ID, event_id: "event-1", lead_email: "u@example.test", teammates: [] } as Record<string, unknown> | null,
  rpcResult = { data: "sub-1", error: null } as { data: unknown; error: unknown },
} = {}) {
  const tables: Record<string, ReturnType<typeof builder>> = {
    events: builder({ data: visibility ? { visibility } : null, error: null }),
    event_intake_form_bindings: builder({ data: binding, error: null }),
    intake_form_versions: builder({ data: { id: VERSION, schema_json: formSchema }, error: null }),
  };
  const rpc = jest.fn().mockResolvedValue(rpcResult);
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from: jest.fn((t: string) => tables[t]), rpc });
  const userClient = {
    // my_project_ids: the caller's projects in the event (membership now comes
    // from this RPC; team email columns are not client-readable).
    rpc: jest.fn().mockResolvedValue({
      data: project && project.lead_email === "u@example.test" ? [project.id] : [],
      error: null,
    }),
    from: jest.fn((t: string) =>
      t === "projects" ? builder({ data: project }) : builder({ data: hasRole ? { id: "role-1" } : null })
    ),
  };
  (getAuthContext as jest.Mock).mockResolvedValue({ supabase: userClient, user, isOrganizer: false, isAdmin: false });
  return { rpc };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/events/event-1/intake-form/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ eventId: "event-1" }) }
  );

const validBody = { context: "registration", formVersionId: VERSION, answers: { name: "Ada", coc: true } };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/events/[eventId]/intake-form/submissions (ORG-010)", () => {
  it("returns 401 without a user", async () => {
    setup({ user: null });
    expect((await post(validBody)).status).toBe(401);
  });

  it("returns 400 on a non-JSON body", async () => {
    setup();
    expect((await post("nope")).status).toBe(400);
  });

  it("returns 413 for bodies over 256KB", async () => {
    const { rpc } = setup();
    const res = await post({ ...validBody, answers: { name: "x".repeat(300 * 1024), coc: true } });
    expect(res.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 404 when the event has no active form for the context", async () => {
    const { rpc } = setup({ binding: null });
    expect((await post(validBody)).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a form version that is not the active binding (e.g. another event's form)", async () => {
    const { rpc } = setup();
    const res = await post({ ...validBody, formVersionId: OTHER_VERSION });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("stale_form_version");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["archived", "registration"],
    ["draft", "registration"],
  ])("rejects submissions for %s events (%s)", async (visibility) => {
    const { rpc } = setup({ visibility });
    expect((await post(validBody)).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty answers with per-field errors and stores nothing", async () => {
    const { rpc } = setup();
    const res = await post({ ...validBody, answers: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toEqual({
      name: "This field is required",
      coc: "This field is required",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unchecked required consent", async () => {
    setup();
    expect((await post({ ...validBody, answers: { name: "Ada", coc: false } })).status).toBe(400);
  });

  it("rejects unknown answer keys", async () => {
    setup();
    const res = await post({ ...validBody, answers: { name: "Ada", coc: true, junk: "x" } });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toEqual({ junk: "Unknown field" });
  });

  it("writes submission and answers atomically through submit_intake_form", async () => {
    const { rpc } = setup();
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, submissionId: "sub-1" });
    expect(rpc).toHaveBeenCalledWith("submit_intake_form", {
      p_event_id: "event-1",
      p_context: "registration",
      p_form_version_id: VERSION,
      p_user_id: "user-1",
      p_project_id: null,
      p_answers: { name: "Ada", coc: true },
    });
  });

  it("returns 500 (nothing half-written) when the RPC fails", async () => {
    setup({ rpcResult: { data: null, error: { message: "boom" } } });
    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to save submission");
  });

  it("rejects a project that belongs to another event", async () => {
    const { rpc } = setup({
      formSchema: surveySchema,
      project: { id: PROJECT_ID, event_id: "event-2", lead_email: "u@example.test", teammates: [] },
    });
    const res = await post({ context: "project_submission", formVersionId: VERSION, projectId: PROJECT_ID, answers: {} });
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a project submission for the member's project in this event", async () => {
    const { rpc } = setup({ formSchema: surveySchema });
    const res = await post({ context: "project_submission", formVersionId: VERSION, projectId: PROJECT_ID, answers: { rating: "5" } });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("submit_intake_form", expect.objectContaining({ p_project_id: PROJECT_ID }));
  });
});

// Cases carried over from the original rsvp/post_survey suite.
describe.each(["rsvp", "post_survey"])("POST intake submissions (%s)", (context) => {
  it("stores the sanitized answers for the active version", async () => {
    const { rpc } = setup({ formSchema: surveySchema });
    const res = await post({ context, formVersionId: VERSION, answers: { attending: "Yes", dietary: "Vegetarian" } });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "submit_intake_form",
      expect.objectContaining({ p_context: context, p_answers: { attending: "Yes", dietary: "Vegetarian" } })
    );
  });

  it("rejects a projectId", async () => {
    setup({ formSchema: surveySchema });
    expect((await post({ context, formVersionId: VERSION, projectId: PROJECT_ID, answers: {} })).status).toBe(400);
  });

  it("returns 403 when the user has no role in the event", async () => {
    const { rpc } = setup({ formSchema: surveySchema, hasRole: false });
    expect((await post({ context, formVersionId: VERSION, answers: { rating: "5" } })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});

it("rejects an unknown context", async () => {
  setup();
  expect((await post({ context: "not_a_context", formVersionId: VERSION, answers: {} })).status).toBe(400);
});
