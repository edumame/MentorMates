/** @jest-environment node */
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

it("only reports prizes won in the event each project belongs to", async () => {
  const projects = [
    { id: "moved", event_id: "event-b" },
    { id: "stayed", event_id: "event-a" },
  ];
  const prizes = [
    {
      id: "prize-a",
      event_tracks: { event_id: "event-a" },
      prize_winners: [{ project_id: "moved" }, { project_id: "stayed" }],
    },
  ];
  const chain = (data: unknown) => {
    const query: Record<string, unknown> = {};
    for (const op of ["select", "eq", "contains", "in"]) {
      query[op] = () => query;
    }
    query.then = (resolve: (value: unknown) => void) =>
      resolve({ data, error: null });
    return query;
  };
  jest.mocked(createSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user", email: "lead@example.test" } },
        error: null,
      }),
    },
    from: (table: string) => chain(table === "projects" ? projects : prizes),
  } as never);

  const body = await (await GET()).json();
  const won = (id: string) =>
    body.projects.find((project: { id: string }) => project.id === id)
      .prizes_won;

  expect(won("moved")).toEqual([]);
  expect(won("stayed")).toHaveLength(1);
});
