/** @jest-environment node */
import { DELETE, POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

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
