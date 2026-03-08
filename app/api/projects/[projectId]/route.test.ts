import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from "stream/web";
import { TextDecoder, TextEncoder } from "util";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

// Next route handlers expect WHATWG request classes that are not available in
// this Jest runtime by default.
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
globalThis.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
globalThis.TransformStream = TransformStream as typeof globalThis.TransformStream;
globalThis.WritableStream = WritableStream as typeof globalThis.WritableStream;

let PATCH: typeof import("./route").PATCH;

describe("PATCH /api/projects/[projectId]", () => {
  const buildProjectLookup = (eventId: string | null) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "project-1",
        event_id: eventId,
        lead_email: "lead@example.com",
      },
      error: null,
    }),
  });

  const buildRoleLookup = (joined: boolean) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: joined ? { role: "participant" } : null,
      error: null,
    }),
  });

  const buildTicketLookup = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  });

  const buildPaymentLookup = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    const edgeRuntimeFetch = await import(
      "next/dist/compiled/@edge-runtime/primitives/fetch"
    );

    globalThis.Headers =
      edgeRuntimeFetch.Headers as typeof globalThis.Headers;
    globalThis.Request =
      edgeRuntimeFetch.Request as typeof globalThis.Request;
    globalThis.Response =
      edgeRuntimeFetch.Response as typeof globalThis.Response;

    // Import after polyfilling the web request primitives Next expects.
    ({ PATCH } = await import("./route"));
  });

  it("rejects assigning a project to a hackathon the user has not joined", async () => {
    const projectLookupBuilder = buildProjectLookup(null);
    const roleLookupBuilder = buildRoleLookup(false);
    const ticketLookupBuilder = buildTicketLookup();
    const paymentLookupBuilder = buildPaymentLookup();

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "lead@example.com" } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "projects") {
          return projectLookupBuilder;
        }

        if (table === "user_event_roles") {
          return roleLookupBuilder;
        }

        if (table === "event_tickets") {
          return ticketLookupBuilder;
        }

        if (table === "user_event_payments") {
          return paymentLookupBuilder;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const request = new Request("http://localhost/api/projects/project-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: "event-2" }),
    });

    const response = await PATCH(request as never, {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You can only assign projects to hackathons you have joined",
    });
  });

  it("rejects reassigning a project that already belongs to a hackathon", async () => {
    const projectLookupBuilder = buildProjectLookup("event-1");

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "lead@example.com" } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "projects") {
          return projectLookupBuilder;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const request = new Request("http://localhost/api/projects/project-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: "event-2" }),
    });

    const response = await PATCH(request as never, {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This project is already assigned to a hackathon",
    });
  });

  it("allows a project lead to assign an unassigned project to a joined hackathon", async () => {
    const projectLookupBuilder = buildProjectLookup(null);
    const roleLookupBuilder = buildRoleLookup(true);
    const ticketLookupBuilder = buildTicketLookup();
    const paymentLookupBuilder = buildPaymentLookup();
    const eventLookupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          event_id: "event-2",
          event_name: "Spring Hackathon",
          submission_time_start: new Date(Date.now() - 60_000).toISOString(),
          submission_time_cutoff: new Date(Date.now() + 60_000).toISOString(),
        },
        error: null,
      }),
    };
    const projectUpdateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    const updatedProjectBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "project-1",
          event_id: "event-2",
          lead_email: "lead@example.com",
        },
        error: null,
      }),
    };

    let projectCallCount = 0;
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "lead@example.com" } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "projects") {
          projectCallCount += 1;
          if (projectCallCount === 1) return projectLookupBuilder;
          if (projectCallCount === 2) return projectUpdateBuilder;
          if (projectCallCount === 3) return updatedProjectBuilder;
        }

        if (table === "user_event_roles") {
          return roleLookupBuilder;
        }

        if (table === "event_tickets") {
          return ticketLookupBuilder;
        }

        if (table === "user_event_payments") {
          return paymentLookupBuilder;
        }

        if (table === "events") {
          return eventLookupBuilder;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const request = new Request("http://localhost/api/projects/project-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: "event-2" }),
    });

    const response = await PATCH(request as never, {
      params: Promise.resolve({ projectId: "project-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(projectUpdateBuilder.update).toHaveBeenCalledWith({
      event_id: "event-2",
    });
    expect(payload).toEqual({
      success: true,
      project: {
        id: "project-1",
        event_id: "event-2",
        lead_email: "lead@example.com",
      },
    });
  });
});
