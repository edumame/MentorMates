/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { PUT } from "./route";
import { getAuthContext, getOrCreateTemplateId } from "./_shared";

jest.mock("./_shared", () => ({
  getAuthContext: jest.fn(),
  getOrCreateTemplateId: jest.fn(),
  getTemplateName: jest.fn(),
}));

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

function makeBody(options: string[]) {
  return {
    context: "registration",
    schema: {
      title: "Form",
      fields: [
        {
          id: "f1",
          key: "colour",
          type: "single_select",
          label: "Colour",
          required: true,
          options,
        },
      ],
    },
  };
}

function buildSupabaseMock() {
  const versionBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: "v1", version_number: 1, published_at: null },
      error: null,
    }),
  };
  const templateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  return {
    versionBuilder,
    supabase: {
      from: jest.fn((table: string) =>
        table === "intake_form_versions" ? versionBuilder : templateBuilder
      ),
    },
  };
}

describe("PUT /api/events/[eventId]/intake-forms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOrCreateTemplateId as jest.Mock).mockResolvedValue("template-1");
  });

  function mockOrganizer() {
    const mock = buildSupabaseMock();
    (getAuthContext as jest.Mock).mockResolvedValue({
      supabase: mock.supabase,
      user: { id: "user-1" },
      isOrganizer: true,
      isAdmin: false,
    });
    return mock;
  }

  it.each([[["A", ""]], [["A", "   "]]])(
    "rejects a draft with blank options %j without storing it",
    async (options) => {
      const { versionBuilder } = mockOrganizer();

      const response = await PUT(makeRequest(makeBody(options)), makeContext());

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Colour");
      expect(versionBuilder.insert).not.toHaveBeenCalled();
    }
  );

  it("stores a draft whose options are all filled in", async () => {
    const { versionBuilder } = mockOrganizer();

    const response = await PUT(makeRequest(makeBody(["A", "B"])), makeContext());

    expect(response.status).toBe(200);
    expect(versionBuilder.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 403 rather than a validation error to non-organizers", async () => {
    const { supabase } = buildSupabaseMock();
    (getAuthContext as jest.Mock).mockResolvedValue({
      supabase,
      user: { id: "user-1" },
      isOrganizer: false,
      isAdmin: false,
    });

    const response = await PUT(makeRequest(makeBody(["A", ""])), makeContext());

    expect(response.status).toBe(403);
  });
});
