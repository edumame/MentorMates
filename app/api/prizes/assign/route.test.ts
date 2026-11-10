/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { DELETE } from "./route";

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
    then: (resolve: (result: { error: unknown }) => void) =>
      resolve({ error: deleteError }),
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
