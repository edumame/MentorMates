/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { PUT } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/features/user/roles/roles", () => ({
  canAccessRole: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCanAccessRole = canAccessRole as jest.Mock;

const eventId = "11111111-1111-4111-8111-111111111111";

function buildOrganizerSupabase() {
  const updateBuilder = { eq: jest.fn().mockResolvedValue({ error: null }) };
  const upsertMock = jest.fn().mockResolvedValue({ error: null });
  return {
    __upsertMock: upsertMock,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer-1" } },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    from: jest.fn((table: string) => {
      if (table === "user_event_roles") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: { role: EventRole.Organizer } }),
        };
      }

      if (table === "event_submission_fields") {
        return {
          update: jest.fn().mockReturnValue(updateBuilder),
          upsert: upsertMock,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest
            .fn()
            .mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("PUT /api/events/[eventId]/submission-fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessRole.mockReturnValue(true);
  });

  it("rejects payloads that omit the locked project_name field", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildOrganizerSupabase());

    const response = await PUT(
      buildRequest({
        fields: [
          {
            key: "project_description",
            label: "Project description",
            field_type: "long_text",
            required: true,
          },
        ],
      }),
      { params: Promise.resolve({ eventId }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      code: "locked_field_missing",
      missing: ["project_name"],
    });
  });

  it("rejects payloads that omit the locked project_description field", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildOrganizerSupabase());

    const response = await PUT(
      buildRequest({
        fields: [
          {
            key: "project_name",
            label: "Project name",
            field_type: "short_text",
            required: true,
          },
        ],
      }),
      { params: Promise.resolve({ eventId }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      code: "locked_field_missing",
      missing: ["project_description"],
    });
  });

  it("rejects empty field arrays as missing both locked fields", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildOrganizerSupabase());

    const response = await PUT(buildRequest({ fields: [] }), {
      params: Promise.resolve({ eventId }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      code: "locked_field_missing",
      missing: ["project_name", "project_description"],
    });
  });

  it("accepts payloads that include both locked fields", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildOrganizerSupabase());

    const response = await PUT(
      buildRequest({
        fields: [
          {
            key: "project_name",
            label: "Project name",
            field_type: "short_text",
            required: true,
          },
          {
            key: "project_description",
            label: "Project description",
            field_type: "long_text",
            required: true,
          },
          {
            key: "demo_video",
            label: "Demo video",
            field_type: "url",
            required: false,
          },
        ],
      }),
      { params: Promise.resolve({ eventId }) },
    );

    expect(response.status).toBe(200);
  });

  it("persists max_files for multi_file fields and clears it for other types", async () => {
    const supabase = buildOrganizerSupabase();
    mockCreateSupabaseClient.mockResolvedValue(supabase);

    const response = await PUT(
      buildRequest({
        fields: [
          {
            key: "project_name",
            label: "Project name",
            field_type: "short_text",
            required: true,
          },
          {
            key: "project_description",
            label: "Project description",
            field_type: "long_text",
            required: true,
          },
          {
            key: "screenshots",
            label: "Screenshots",
            field_type: "multi_file",
            required: false,
            max_files: 8,
          },
          {
            key: "default_limit",
            label: "Default limit",
            field_type: "multi_file",
            required: false,
          },
          {
            key: "one_file",
            label: "One file",
            field_type: "file",
            required: false,
            max_files: 10,
          },
        ],
      }),
      { params: Promise.resolve({ eventId }) },
    );

    expect(response.status).toBe(200);
    const upsertedRows = supabase.__upsertMock.mock.calls[0][0] as Array<{
      key: string;
      max_files: number | null;
    }>;
    const rowByKey = new Map(upsertedRows.map((row) => [row.key, row]));
    expect(rowByKey.get("screenshots")?.max_files).toBe(8);
    expect(rowByKey.get("default_limit")?.max_files).toBe(5);
    expect(rowByKey.get("one_file")?.max_files).toBeNull();
  });

  it("rejects out-of-range max_files values", async () => {
    mockCreateSupabaseClient.mockResolvedValue(buildOrganizerSupabase());

    const response = await PUT(
      buildRequest({
        fields: [
          {
            key: "project_name",
            label: "Project name",
            field_type: "short_text",
            required: true,
          },
          {
            key: "project_description",
            label: "Project description",
            field_type: "long_text",
            required: true,
          },
          {
            key: "screenshots",
            label: "Screenshots",
            field_type: "multi_file",
            required: false,
            max_files: 50,
          },
        ],
      }),
      { params: Promise.resolve({ eventId }) },
    );

    expect(response.status).toBe(400);
  });
});
