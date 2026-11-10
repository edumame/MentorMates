/** @jest-environment node */
import { DELETE } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const PRIZE_ID = "prize-1";

function buildSupabase({
  winnerCount = 0,
  winnerError = null,
}: {
  winnerCount?: number | null;
  winnerError?: { message: string } | null;
}) {
  const deleteEq = jest.fn().mockResolvedValue({ error: null });
  const prizeDelete = jest.fn(() => ({ eq: deleteEq }));

  const prizes = {
    select: () => ({
      eq: () => ({
        single: () => ({
          overrideTypes: async () => ({
            data: {
              id: PRIZE_ID,
              track_id: "track-1",
              event_tracks: { event_id: "event-1" },
            },
            error: null,
          }),
        }),
      }),
    }),
    delete: prizeDelete,
  };

  const roles = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "organizer" }, error: null }),
        }),
      }),
    }),
  };

  const winners = {
    select: () => ({
      eq: async () => ({ count: winnerCount, error: winnerError }),
    }),
  };

  const tables: Record<string, unknown> = {
    prizes,
    user_event_roles: roles,
    prize_winners: winners,
  };

  return {
    client: {
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: (table: string) => tables[table],
    },
    prizeDelete,
  };
}

const del = (query: string) =>
  DELETE(new Request(`http://localhost/api/prizes?${query}`, { method: "DELETE" }));

describe("DELETE /api/prizes", () => {
  it("refuses to delete a prize with winners unless force is passed", async () => {
    const { client, prizeDelete } = buildSupabase({ winnerCount: 2 });
    (createSupabaseClient as jest.Mock).mockResolvedValue(client);

    const response = await del(`prizeId=${PRIZE_ID}`);

    expect(response.status).toBe(409);
    expect(prizeDelete).not.toHaveBeenCalled();
  });

  it("deletes a prize with winners when force is passed", async () => {
    const { client, prizeDelete } = buildSupabase({ winnerCount: 2 });
    (createSupabaseClient as jest.Mock).mockResolvedValue(client);

    const response = await del(`prizeId=${PRIZE_ID}&force=true`);

    expect(response.status).toBe(200);
    expect(prizeDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes a prize with no winners without force", async () => {
    const { client, prizeDelete } = buildSupabase({ winnerCount: 0 });
    (createSupabaseClient as jest.Mock).mockResolvedValue(client);

    const response = await del(`prizeId=${PRIZE_ID}`);

    expect(response.status).toBe(200);
    expect(prizeDelete).toHaveBeenCalledTimes(1);
  });

  it("does not delete when the winner check fails", async () => {
    const { client, prizeDelete } = buildSupabase({
      winnerCount: null,
      winnerError: { message: "boom" },
    });
    (createSupabaseClient as jest.Mock).mockResolvedValue(client);

    const response = await del(`prizeId=${PRIZE_ID}`);

    expect(response.status).toBe(500);
    expect(prizeDelete).not.toHaveBeenCalled();
  });
});
