/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { POST } from "./route";
import { getAuthContext, getOrCreateTemplateId } from "../_shared";

jest.mock("../_shared", () => ({
  getAuthContext: jest.fn(),
  getOrCreateTemplateId: jest.fn(),
}));

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

function makeSchema(options: string[]) {
  return {
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
  };
}

function mockOrganizer(latestVersion: Record<string, unknown> | null = null) {
  const versionBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: latestVersion, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: "v1", version_number: 1, published_at: "2026-01-01" },
      error: null,
    }),
  };
  const bindingBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
  };

  (getAuthContext as jest.Mock).mockResolvedValue({
    supabase: {
      from: jest.fn((table: string) =>
        table === "intake_form_versions" ? versionBuilder : bindingBuilder
      ),
    },
    user: { id: "user-1" },
    isOrganizer: true,
    isAdmin: false,
  });

  return { versionBuilder, bindingBuilder };
}

describe("POST /api/events/[eventId]/intake-forms/publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOrCreateTemplateId as jest.Mock).mockResolvedValue("template-1");
  });

  it.each([[["A", ""]], [["A", "   "]]])(
    "rejects a schema with blank options %j without publishing it",
    async (options) => {
      const { versionBuilder, bindingBuilder } = mockOrganizer();

      const response = await POST(
        makeRequest({ context: "registration", schema: makeSchema(options) }),
        makeContext()
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Colour");
      expect(versionBuilder.insert).not.toHaveBeenCalled();
      expect(bindingBuilder.insert).not.toHaveBeenCalled();
    }
  );

  it("rejects publishing a stored draft that has a blank option", async () => {
    const { versionBuilder, bindingBuilder } = mockOrganizer({
      id: "draft-1",
      version_number: 2,
      published_at: null,
      schema_json: makeSchema(["A", ""]),
    });

    const response = await POST(
      makeRequest({ context: "registration" }),
      makeContext()
    );

    expect(response.status).toBe(400);
    expect(versionBuilder.update).not.toHaveBeenCalled();
    expect(bindingBuilder.insert).not.toHaveBeenCalled();
  });

  it("publishes a schema whose options are all filled in", async () => {
    const { versionBuilder, bindingBuilder } = mockOrganizer();

    const response = await POST(
      makeRequest({ context: "registration", schema: makeSchema(["A", "B"]) }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(versionBuilder.insert).toHaveBeenCalledTimes(1);
    expect(bindingBuilder.insert).toHaveBeenCalledTimes(1);
  });
});
