/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { POST } from "./route";
import { getAuthContext } from "../../intake-forms/_shared";

jest.mock("../../intake-forms/_shared", () => ({
  getAuthContext: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const FORM_VERSION_ID = "123e4567-e89b-12d3-a456-426614174000";
const PROJECT_ID = "223e4567-e89b-12d3-a456-426614174000";

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

function buildSupabaseMock({
  existingSubmissionId = null,
  hasRole = true,
}: {
  existingSubmissionId?: string | null;
  hasRole?: boolean;
} = {}) {
  const roleBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: hasRole ? { id: "role-1" } : null,
      error: null,
    }),
  };

  const versionBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: FORM_VERSION_ID },
      error: null,
    }),
  };

  const submissionLookupBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: existingSubmissionId ? { id: existingSubmissionId } : null,
      error: null,
    }),
  };

  const submissionUpdateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  const submissionInsertBuilder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: "sub-new" },
      error: null,
    }),
  };

  const answersDeleteBuilder = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  const answersInsertBuilder = {
    insert: jest.fn().mockResolvedValue({ error: null }),
  };

  let submissionsCalls = 0;
  let answersCalls = 0;

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === "user_event_roles") return roleBuilder;
    if (table === "intake_form_versions") return versionBuilder;
    if (table === "intake_form_submissions") {
      submissionsCalls += 1;
      if (submissionsCalls === 1) return submissionLookupBuilder;
      return existingSubmissionId
        ? submissionUpdateBuilder
        : submissionInsertBuilder;
    }
    if (table === "intake_form_submission_answers") {
      answersCalls += 1;
      return answersCalls === 1 ? answersDeleteBuilder : answersInsertBuilder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    submissionUpdateBuilder,
    submissionInsertBuilder,
    answersDeleteBuilder,
    answersInsertBuilder,
  };
}

function mockAuth(supabase: unknown) {
  (getAuthContext as jest.Mock).mockResolvedValue({
    supabase,
    user: { id: "user-1", email: "user@test.dev" },
    isOrganizer: false,
    isAdmin: false,
  });
}

describe("POST /api/events/[eventId]/intake-form/submissions (rsvp)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resubmission updates the existing submission and re-stamps every answer with the form version", async () => {
    const mocks = buildSupabaseMock({ existingSubmissionId: "sub-1" });
    mockAuth(mocks.supabase);

    const response = await POST(
      makeRequest({
        context: "rsvp",
        formVersionId: FORM_VERSION_ID,
        answers: { attending: "Yes", dietary: "Vegetarian" },
      }),
      makeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, submissionId: "sub-1" });

    // Existing submission is updated, not duplicated.
    expect(mocks.submissionUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        form_version_id: FORM_VERSION_ID,
        status: "submitted",
      })
    );
    expect(mocks.submissionInsertBuilder.insert).not.toHaveBeenCalled();

    // Full replace: old answers deleted, new ones stamped with the version.
    expect(mocks.answersDeleteBuilder.delete).toHaveBeenCalled();
    expect(mocks.answersDeleteBuilder.eq).toHaveBeenCalledWith(
      "submission_id",
      "sub-1"
    );
    expect(mocks.answersInsertBuilder.insert).toHaveBeenCalledWith([
      {
        submission_id: "sub-1",
        form_version_id: FORM_VERSION_ID,
        field_key: "attending",
        value_json: "Yes",
      },
      {
        submission_id: "sub-1",
        form_version_id: FORM_VERSION_ID,
        field_key: "dietary",
        value_json: "Vegetarian",
      },
    ]);
  });

  it("first submission inserts a new submission row", async () => {
    const mocks = buildSupabaseMock({ existingSubmissionId: null });
    mockAuth(mocks.supabase);

    const response = await POST(
      makeRequest({
        context: "rsvp",
        formVersionId: FORM_VERSION_ID,
        answers: { attending: "Yes" },
      }),
      makeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, submissionId: "sub-new" });
    expect(mocks.submissionInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-1",
        context: "rsvp",
        submitter_user_id: "user-1",
        project_id: null,
        status: "submitted",
      })
    );
    expect(mocks.submissionUpdateBuilder.update).not.toHaveBeenCalled();
  });

  it("rejects a projectId for the rsvp context", async () => {
    const mocks = buildSupabaseMock();
    mockAuth(mocks.supabase);

    const response = await POST(
      makeRequest({
        context: "rsvp",
        formVersionId: FORM_VERSION_ID,
        projectId: PROJECT_ID,
        answers: {},
      }),
      makeContext()
    );

    expect(response.status).toBe(400);
  });

  it("returns 403 when the user has no role in the event", async () => {
    const mocks = buildSupabaseMock({ hasRole: false });
    mockAuth(mocks.supabase);

    const response = await POST(
      makeRequest({
        context: "rsvp",
        formVersionId: FORM_VERSION_ID,
        answers: { attending: "Yes" },
      }),
      makeContext()
    );

    expect(response.status).toBe(403);
  });
});
