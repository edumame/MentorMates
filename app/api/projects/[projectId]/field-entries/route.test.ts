/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { GET, POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateServiceClient = createSupabaseServiceClient as jest.Mock;

const projectId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";
const fieldId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

const entryRow = {
  id: "55555555-5555-4555-8555-555555555555",
  project_id: projectId,
  event_submission_field_id: fieldId,
  submitter_user_id: userId,
  content: "Implemented the scoring API",
  created_at: "2026-07-31T00:00:00Z",
  updated_at: "2026-07-31T00:00:00Z",
};

const logField = {
  id: fieldId,
  event_id: eventId,
  key: "submission_log",
  label: "Submission Log",
  field_type: "long_text",
  required: false,
  sort_order: 0,
  is_active: true,
  options: [],
  allows_multiple_entries: true,
};

function buildAuthedClient({
  user = { id: userId },
  project = { id: projectId, event_id: eventId },
  insertResult = { data: entryRow, error: null },
}: {
  user?: { id: string } | null;
  project?: { id: string; event_id: string } | null;
  insertResult?: { data: typeof entryRow | null; error: unknown };
} = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: jest.fn((table: string) => {
      if (table === "projects") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: project }),
        };
      }
      if (table === "project_field_entries") {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(insertResult),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function buildServiceClient({
  fields = [logField],
  field = logField,
  entries = [entryRow],
  profiles = [{ uid: userId, display_name: "Jamie" }],
}: {
  fields?: Array<typeof logField>;
  field?: typeof logField | null;
  entries?: Array<typeof entryRow>;
  profiles?: Array<{ uid: string; display_name: string | null }>;
} = {}) {
  return {
    from: jest.fn((table: string) => {
      if (table === "event_submission_fields") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: field }),
          order: jest.fn().mockReturnValue({
            overrideTypes: jest
              .fn()
              .mockResolvedValue({ data: fields, error: null }),
          }),
        };
      }
      if (table === "project_field_entries") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: entries, error: null }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: profiles, error: null }),
          maybeSingle: jest.fn().mockResolvedValue({ data: profiles[0] ?? null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function buildPostRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ projectId }) };

describe("GET /api/projects/[projectId]/field-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns entry fields and attributed entries for a visible project", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await GET(
      new NextRequest("http://localhost/test"),
      routeParams,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.fields).toHaveLength(1);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0]).toMatchObject({
      id: entryRow.id,
      content: entryRow.content,
      submitter_user_id: userId,
      submitter_display_name: "Jamie",
    });
    expect(json.viewerUserId).toBe(userId);
  });

  it("returns 404 when the project is not visible to the viewer", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildAuthedClient({ project: null }),
    );
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await GET(
      new NextRequest("http://localhost/test"),
      routeParams,
    );

    expect(response.status).toBe(404);
  });

  it("returns empty lists when no fields allow multiple entries", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(buildServiceClient({ fields: [] }));

    const response = await GET(
      new NextRequest("http://localhost/test"),
      routeParams,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.fields).toEqual([]);
    expect(json.entries).toEqual([]);
  });
});

describe("POST /api/projects/[projectId]/field-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildAuthedClient({ user: null }),
    );
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await POST(
      buildPostRequest({ fieldId, content: "hello" }),
      routeParams,
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid bodies", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await POST(
      buildPostRequest({ fieldId, content: "   " }),
      routeParams,
    );

    expect(response.status).toBe(400);
  });

  it("rejects fields that do not allow multiple entries", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(
      buildServiceClient({
        field: { ...logField, allows_multiple_entries: false },
      }),
    );

    const response = await POST(
      buildPostRequest({ fieldId, content: "hello" }),
      routeParams,
    );

    expect(response.status).toBe(400);
  });

  it("rejects fields that belong to another event", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(
      buildServiceClient({
        field: { ...logField, event_id: "99999999-9999-4999-8999-999999999999" },
      }),
    );

    const response = await POST(
      buildPostRequest({ fieldId, content: "hello" }),
      routeParams,
    );

    expect(response.status).toBe(400);
  });

  it("creates an entry attributed to the caller", async () => {
    const authedClient = buildAuthedClient();
    mockCreateSupabaseClient.mockResolvedValue(authedClient);
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await POST(
      buildPostRequest({ fieldId, content: "Implemented the scoring API" }),
      routeParams,
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.entry).toMatchObject({
      id: entryRow.id,
      submitter_user_id: userId,
      submitter_display_name: "Jamie",
      content: entryRow.content,
    });

    const insertMock = authedClient.from.mock.results
      .map((result) => result.value)
      .find((value) => value && "insert" in value)?.insert as jest.Mock;
    expect(insertMock).toHaveBeenCalledWith({
      project_id: projectId,
      event_submission_field_id: fieldId,
      submitter_user_id: userId,
      content: "Implemented the scoring API",
    });
  });

  it("creates an attachment-only entry with structured content", async () => {
    const authedClient = buildAuthedClient();
    mockCreateSupabaseClient.mockResolvedValue(authedClient);
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const attachments = [
      { name: "demo.pdf", url: "https://cdn.example.com/demo.pdf" },
    ];
    const response = await POST(
      buildPostRequest({ fieldId, attachments }),
      routeParams,
    );

    expect(response.status).toBe(201);

    const insertMock = authedClient.from.mock.results
      .map((result) => result.value)
      .find((value) => value && "insert" in value)?.insert as jest.Mock;
    expect(insertMock).toHaveBeenCalledWith({
      project_id: projectId,
      event_submission_field_id: fieldId,
      submitter_user_id: userId,
      content: { text: "", attachments },
    });
  });

  it("rejects entries exceeding the attachment limit", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildAuthedClient());
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const attachments = Array.from({ length: 6 }, (_, index) => ({
      name: `file-${index}.png`,
      url: `https://cdn.example.com/file-${index}.png`,
    }));
    const response = await POST(
      buildPostRequest({ fieldId, attachments }),
      routeParams,
    );

    expect(response.status).toBe(400);
  });

  it("returns 403 when RLS rejects the insert", async () => {
    mockCreateSupabaseClient.mockResolvedValue(
      buildAuthedClient({
        insertResult: { data: null, error: { message: "RLS violation" } },
      }),
    );
    mockCreateServiceClient.mockReturnValue(buildServiceClient());

    const response = await POST(
      buildPostRequest({ fieldId, content: "hello" }),
      routeParams,
    );

    expect(response.status).toBe(403);
  });
});
