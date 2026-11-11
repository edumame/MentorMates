/** @jest-environment node */
import { createCallerFactory } from "@/trpc/init";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { meetingsRouter } from "./procedures";

// React's server-only cache() is absent from the client build Jest resolves.
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: {} }));

type Row = { user_id: string; event_id: string | null; project_id: string | null };

const BATCH_SIZE = 1000;

const mockSupabase = (rows: Row[], error: { message: string } | null = null) => {
  const ranges: Array<[number, number]> = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => {
      expect(table).toBe("meetings");
      let userId = "";
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          expect(column).toBe("user_id");
          userId = value;
          return query;
        },
        order: () => query,
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return {
            data: error ? null : rows.filter((r) => r.user_id === userId).slice(from, to + 1),
            error,
          };
        },
      };
      return query;
    },
  };
  (createSupabaseClient as jest.Mock).mockResolvedValue(client);
  return ranges;
};

const caller = () => createCallerFactory(meetingsRouter)({ userId: "user-1" });

describe("meetings.getFilterOptions", () => {
  it("returns each distinct event and project across all of the user's meetings", async () => {
    mockSupabase([
      { user_id: "user-1", event_id: "a", project_id: "p" },
      { user_id: "user-1", event_id: "a", project_id: null },
      { user_id: "user-1", event_id: "b", project_id: "q" },
      { user_id: "user-1", event_id: null, project_id: null },
      { user_id: "user-2", event_id: "other", project_id: "other" },
    ]);

    await expect(caller().getFilterOptions()).resolves.toEqual({
      eventIds: ["a", "b"],
      projectIds: ["p", "q"],
    });
  });

  it("reads past the row cap of a single response", async () => {
    const ranges = mockSupabase([
      ...Array.from({ length: BATCH_SIZE }, () => ({ user_id: "user-1", event_id: "a", project_id: null })),
      { user_id: "user-1", event_id: "b", project_id: null },
    ]);

    await expect(caller().getFilterOptions()).resolves.toEqual({
      eventIds: ["a", "b"],
      projectIds: [],
    });
    expect(ranges).toEqual([
      [0, BATCH_SIZE - 1],
      [BATCH_SIZE, 2 * BATCH_SIZE - 1],
    ]);
  });

  it("returns empty lists when the user has no meetings", async () => {
    mockSupabase([]);

    await expect(caller().getFilterOptions()).resolves.toEqual({ eventIds: [], projectIds: [] });
  });

  it("surfaces query errors", async () => {
    mockSupabase([], { message: "boom" });

    await expect(caller().getFilterOptions()).rejects.toMatchObject({ message: "boom" });
  });
});
