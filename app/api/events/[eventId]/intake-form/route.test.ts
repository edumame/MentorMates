/** @jest-environment node */
import type { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthContext } from "../intake-forms/_shared";

jest.mock("../intake-forms/_shared", () => ({ getAuthContext: jest.fn() }));
const request = (context = "rsvp") =>
  ({
    nextUrl: { searchParams: new URLSearchParams({ context }) },
  }) as unknown as NextRequest;
const routeContext = { params: Promise.resolve({ eventId: "event-1" }) };
function setup({
  user = { id: "current-user" } as { id: string } | null,
  role = true,
  submission = true,
  version = true,
  error = false,
} = {}) {
  const make = (data: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data }),
    single: jest.fn().mockResolvedValue({ data }),
  });
  const roles = make(role ? { id: "role-1" } : null);
  const binding = make({ form_version_id: "version-1" });
  const versions = make(
    version
      ? {
          id: "version-1",
          version_number: 1,
          schema_json: { title: "RSVP", fields: [] },
        }
      : null,
  );
  const submissions = make(submission ? { id: "submission-1" } : null);
  if (error)
    submissions.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "read failed" },
    });
  const answers = {
    select: jest.fn().mockReturnThis(),
    eq: jest
      .fn()
      .mockResolvedValue({
        data: [{ field_key: "notes", value_json: "Saved notes" }],
      }),
  };
  const tables: Record<string, unknown> = {
    user_event_roles: roles,
    event_intake_form_bindings: binding,
    intake_form_versions: versions,
    intake_form_submissions: submissions,
    intake_form_submission_answers: answers,
  };
  const from = jest.fn((table: string) => tables[table]);
  (getAuthContext as jest.Mock).mockResolvedValue({
    user,
    isAdmin: false,
    supabase: { from },
  });
  return { from, submissions, answers };
}

beforeEach(() => jest.clearAllMocks());
it("restores only the current user, event, context, active version and submitted answers", async () => {
  const { submissions, answers } = setup();
  const response = await GET(request(), routeContext);
  expect(response.status).toBe(200);
  expect((await response.json()).form.answers).toEqual({
    notes: "Saved notes",
  });
  for (const pair of [
    ["event_id", "event-1"],
    ["context", "rsvp"],
    ["submitter_user_id", "current-user"],
    ["form_version_id", "version-1"],
    ["status", "submitted"],
  ])
    expect(submissions.eq).toHaveBeenCalledWith(...pair);
  expect(answers.eq).toHaveBeenCalledWith("submission_id", "submission-1");
});
it("returns empty answers when no current-version submission exists", async () => {
  const { from } = setup({ submission: false });
  const response = await GET(request(), routeContext);
  expect((await response.json()).form.answers).toEqual({});
  expect(from).not.toHaveBeenCalledWith("intake_form_submission_answers");
});
it("returns no form when the active version is missing", async () => {
  const { from } = setup({ version: false });
  expect(await (await GET(request(), routeContext)).json()).toEqual({
    form: null,
  });
  expect(from).not.toHaveBeenCalledWith("intake_form_submissions");
});
it.each([
  [null, true, 401],
  [{ id: "current-user" }, false, 403],
] as const)(
  "does not read answers for denied access",
  async (user, role, status) => {
    const { from } = setup({ user, role });
    expect((await GET(request(), routeContext)).status).toBe(status);
    expect(from).not.toHaveBeenCalledWith("intake_form_submissions");
  },
);
it("does not restore project-specific answers without a project ID", async () => {
  const { from } = setup();
  expect(
    (await (await GET(request("project_submission"), routeContext)).json()).form
      .answers,
  ).toEqual({});
  expect(from).not.toHaveBeenCalledWith("intake_form_submissions");
});
it("fails visibly instead of returning a blank form when saved answers cannot be read", async () => {
  setup({ error: true });
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await GET(request(), routeContext)).status).toBe(500);
  spy.mockRestore();
});
