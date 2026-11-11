/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { DELETE, POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;

function mockSupabase(role: string, deleteError: unknown = null) {
  const deleteFilters: [string, string][] = [];

  const deleteBuilder = {
    eq(column: string, value: string): unknown {
      deleteFilters.push([column, value]);
      return deleteBuilder;
    },
    // The route reads back the removed rows to detect RLS-hidden deletes.
    select: async () => ({
      data: deleteError ? null : [{ id: "winner-1" }],
      error: deleteError,
    }),
  };

  const single = (data: unknown) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: () => builder,
      overrideTypes: () => builder,
      then: (resolve: (result: { data: unknown; error: null }) => void) =>
        resolve({ data, error: null }),
    };
    return builder;
  };

  const client = {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: "organizer-1" } },
        error: null,
      })),
    },
    from: jest.fn((table: string) => {
      if (table === "prizes") {
        return single({
          id: "prize-1",
          track_id: "track-1",
          event_tracks: { event_id: "event-1" },
        });
      }
      if (table === "user_event_roles") {
        return single({ role });
      }
      return { delete: jest.fn(() => deleteBuilder) };
    }),
  };

  mockCreateSupabaseClient.mockResolvedValue(client);
  return { client, deleteFilters };
}

const deleteRequest = (query: string) =>
  new Request(`http://localhost/api/prizes/assign?${query}`, {
    method: "DELETE",
  });

describe("DELETE /api/prizes/assign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes only the row matching both the prize and the project", async () => {
    const { client, deleteFilters } = mockSupabase("organizer");

    const response = await DELETE(
      deleteRequest("prizeId=prize-1&projectId=project-1")
    );

    expect(response.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith("prize_winners");
    expect(deleteFilters).toEqual([
      ["prize_id", "prize-1"],
      ["project_id", "project-1"],
    ]);
  });

  it("rejects a request without a project id instead of clearing the prize", async () => {
    const { client } = mockSupabase("organizer");

    const response = await DELETE(deleteRequest("prizeId=prize-1"));

    expect(response.status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("does not delete for a user who is not an organizer", async () => {
    const { client } = mockSupabase("participant");

    const response = await DELETE(
      deleteRequest("prizeId=prize-1&projectId=project-1")
    );

    expect(response.status).toBe(403);
    expect(client.from).not.toHaveBeenCalledWith("prize_winners");
  });

  it("reports a database failure", async () => {
    mockSupabase("organizer", { message: "boom" });

    const response = await DELETE(
      deleteRequest("prizeId=prize-1&projectId=project-1")
    );

    expect(response.status).toBe(500);
  });
});

const prizeId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

function mockClient(deleted: { data: unknown; error: unknown }) {
  const deleteChain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(deleted),
    // Awaiting without .select() resolves with no rows and no error, exactly
    // like PostgREST does when RLS hides every row.
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: null, error: null }),
  };
  const single = (data: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    overrideTypes: jest.fn().mockResolvedValue({ data, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  });

  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "organizer" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "prizes") {
        return single({
          id: prizeId,
          track_id: "track",
          event_tracks: { event_id: "event-a" },
        });
      }
      if (table === "user_event_roles") return single({ role: "organizer" });
      if (table === "prize_winners") {
        return { delete: () => deleteChain };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as never);
}

const removeWinner = () =>
  DELETE(
    new Request(
      `https://example.test/api/prizes/assign?prizeId=${prizeId}&projectId=${projectId}`,
      { method: "DELETE" },
    ),
  );
const unassignPrize = () =>
  POST(
    new Request("https://example.test/api/prizes/assign", {
      method: "POST",
      body: JSON.stringify({ prizeId, projectId: null }),
    }),
  );

describe.each([
  ["DELETE", removeWinner],
  ["POST with a null project", unassignPrize],
])("%s", (_name, run) => {
  it("reports failure when no winner row was actually removed", async () => {
    mockClient({ data: [], error: null });

    const response = await run();

    expect(response.status).toBe(404);
    expect((await response.json()).success).toBeUndefined();
  });

  it("reports success when a winner row was removed", async () => {
    mockClient({ data: [{ id: "winner" }], error: null });

    const response = await run();

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it("reports failure when the delete errors", async () => {
    mockClient({ data: null, error: { message: "boom" } });

    const response = await run();

    expect(response.status).toBe(500);
  });
});
