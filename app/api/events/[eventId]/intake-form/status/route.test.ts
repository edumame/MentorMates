/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const FORM_VERSION_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(context?: string) {
  const searchParams = new URLSearchParams();
  if (context) searchParams.set("context", context);
  return { nextUrl: { searchParams } } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

function mockSupabase({
  user = { id: "user-1" },
  event = { event_id: "event-1" },
  binding = null,
  submission = null,
}: {
  user?: { id: string } | null;
  event?: { event_id: string } | null;
  binding?: { form_version_id: string } | null;
  submission?: { id: string } | null;
} = {}) {
  const eventsBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: event, error: null }),
  };

  const bindingBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: binding, error: null }),
  };

  const submissionBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: submission, error: null }),
  };

  const supabase = {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user }, error: user ? null : new Error("no user") }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "events") return eventsBuilder;
      if (table === "event_intake_form_bindings") return bindingBuilder;
      if (table === "intake_form_submissions") return submissionBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue(supabase);
  return { supabase, bindingBuilder, submissionBuilder };
}

describe("GET /api/events/[eventId]/intake-form/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when context is missing", async () => {
    mockSupabase();

    const response = await GET(makeRequest(), makeContext());

    expect(response.status).toBe(400);
  });

  it("returns 400 for the project_submission context (not per-user)", async () => {
    mockSupabase();

    const response = await GET(
      makeRequest("project_submission"),
      makeContext()
    );

    expect(response.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });

    const response = await GET(makeRequest("rsvp"), makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 404 when the event does not exist", async () => {
    mockSupabase({ event: null });

    const response = await GET(makeRequest("registration"), makeContext());

    expect(response.status).toBe(404);
  });

  it.each(["registration", "rsvp", "post_survey"] as const)(
    "reports no active form for %s when no binding exists",
    async (context) => {
      const { bindingBuilder } = mockSupabase({ binding: null });

      const response = await GET(makeRequest(context), makeContext());
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ hasActiveForm: false, completed: false });
      expect(bindingBuilder.eq).toHaveBeenCalledWith("context", context);
    }
  );

  it("reports an active, uncompleted form when a binding exists without a submission", async () => {
    mockSupabase({
      binding: { form_version_id: FORM_VERSION_ID },
      submission: null,
    });

    const response = await GET(makeRequest("post_survey"), makeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ hasActiveForm: true, completed: false });
  });

  it("reports completion when the user already submitted", async () => {
    const { submissionBuilder } = mockSupabase({
      binding: { form_version_id: FORM_VERSION_ID },
      submission: { id: "sub-1" },
    });

    const response = await GET(makeRequest("post_survey"), makeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ hasActiveForm: true, completed: true });
    expect(submissionBuilder.eq).toHaveBeenCalledWith("context", "post_survey");
    expect(submissionBuilder.eq).toHaveBeenCalledWith("status", "submitted");
  });
});
