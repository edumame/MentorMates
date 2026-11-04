/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const oldEvent = "event-old";
const currentEvent = "event-current";
const projectId = "project-1";

const projectRow = {
  id: projectId,
  project_name: "Moved",
  lead_name: "Lead",
  lead_email: "lead@example.test",
  project_description: "Description",
  teammates: [],
  event_id: currentEvent,
  private: false,
  submitted: true,
  project_tracks: [],
};

const prize = (eventId: string) => ({
  id: `prize-${eventId}`,
  track_id: `track-${eventId}`,
  prize_amount: "100",
  prize_description: `Prize from ${eventId}`,
  event_tracks: { event_id: eventId },
});

let prizes: ReturnType<typeof prize>[];
let advancements: { id: string; event_id: string }[];

function client() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user", email: "lead@example.test" } },
        error: null,
      }),
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const result = () => {
        switch (table) {
          case "projects":
            return {
              data: filters.single ? projectRow : [projectRow],
              error: null,
            };
          case "events":
            return { data: { visibility: "public" }, error: null };
          case "prize_winners":
            return {
              data: prizes.map((row) => ({
                id: `winner-${row.id}`,
                project_id: projectId,
                assigned_at: "2026-01-01",
                assigned_by: "organizer",
                prizes: row,
              })),
              error: null,
            };
          case "prizes":
            return {
              data: prizes.map((row) => ({
                ...row,
                prize_winners: [
                  {
                    id: `winner-${row.id}`,
                    project_id: projectId,
                    assigned_at: "2026-01-01",
                    assigned_by: "organizer",
                  },
                ],
              })),
              error: null,
            };
          case "project_round_advancements":
            return {
              data: advancements.filter(
                (row) =>
                  filters.event_id === undefined ||
                  row.event_id === filters.event_id,
              ),
              error: null,
            };
          default:
            return { data: [], error: null };
        }
      };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "in", "order", "limit", "overrideTypes"]) {
        chain[op] = () => chain;
      }
      chain.eq = (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      };
      chain.single = chain.maybeSingle = () => {
        filters.single = true;
        return chain;
      };
      chain.then = (resolve: (value: unknown) => void) => resolve(result());
      return chain;
    },
  };
}

const get = (query: string) =>
  GET(new NextRequest(`https://example.test/api/projects?${query}`));

beforeEach(() => {
  prizes = [];
  advancements = [];
  jest.mocked(createSupabaseClient).mockResolvedValue(client() as never);
  jest.mocked(createSupabaseServiceClient).mockReturnValue(client() as never);
});

describe.each([
  ["public single project", `public=true&projectId=${projectId}`],
  ["authenticated single project", `projectId=${projectId}`],
])("%s", (_name, query) => {
  it("ignores prizes and advancements from an event the project left", async () => {
    prizes = [prize(oldEvent)];
    advancements = [{ id: "advancement", event_id: oldEvent }];

    const { project } = await (await get(query)).json();

    expect(project.prizes_won).toEqual([]);
    expect(project.is_finalist).toBe(false);
  });

  it("keeps prizes and advancements from the project's own event", async () => {
    prizes = [prize(oldEvent), prize(currentEvent)];
    advancements = [{ id: "advancement", event_id: currentEvent }];

    const { project } = await (await get(query)).json();

    expect(project.prizes_won).toHaveLength(1);
    expect(project.is_finalist).toBe(true);
  });
});

describe("public event gallery", () => {
  it("only shows prizes awarded in that event", async () => {
    prizes = [prize(oldEvent), prize(currentEvent)];

    const { projects } = await (
      await get(`public=true&eventId=${currentEvent}`)
    ).json();

    expect(projects[0].prizes_won).toEqual([
      expect.objectContaining({ id: `prize-${currentEvent}` }),
    ]);
  });
});
