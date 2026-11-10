import { fetchDashboardCounts } from "./dashboard-stats";

type Result = { data?: unknown; count?: number | null; error: unknown };
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

function client(results: Record<string, Result>) {
  return {
    rpc: async (name: string, args: unknown) => { calls.push({ table: "rpc", method: name, args: [args] }); return results.rpc ?? { data: [], error: null }; },
    from(table: string) {
      const self: Record<string, unknown> = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") return (resolve: (v: Result) => unknown) => resolve(results[table] ?? { data: [], count: 0, error: null });
          return (...args: unknown[]) => { calls.push({ table, method: String(prop), args }); return self; };
        },
      });
      return self;
    },
  } as never;
}

beforeEach(() => { calls.length = 0; });
const user = { id: "u1" };
const now = new Date("2026-11-08T12:00:00Z");

it("counts only joined events that already happened (not draft/archived; null visibility ok) and deduped projects", async () => {
  const counts = await fetchDashboardCounts(client({
    user_event_roles: { data: [{ event_id: "past" }, { event_id: "past" }, { event_id: "future" }, { event_id: "draft" }, { event_id: "archived" }, { event_id: "nullvis" }], error: null },
    events: { data: [
      { event_id: "past", event_date: "2026-10-01T00:00:00Z", visibility: "public" },
      { event_id: "future", event_date: "2026-12-01T00:00:00Z", visibility: "public" },
      { event_id: "draft", event_date: "2026-10-01T00:00:00Z", visibility: "draft" },
      { event_id: "archived", event_date: "2026-10-01T00:00:00Z", visibility: "archived" },
      { event_id: "nullvis", event_date: "2026-10-02T00:00:00Z", visibility: null },
    ], error: null },
    rpc: { data: ["p1", "p1", "p2"], error: null },
    feedback: { count: 4, error: null },
  }), user, now);
  expect(counts).toEqual({ events: 2, projects: 2, feedback: 4 });
  expect(calls).toContainEqual({ table: "user_event_roles", method: "in", args: ["role", ["participant", "mentor", "judge"]] });
  expect(calls).toContainEqual({ table: "rpc", method: "my_project_ids", args: [{}] });
  expect(calls).toContainEqual({ table: "feedback", method: "in", args: ["project_id", ["p1", "p2"]] });
});

it("skips event/feedback queries when there is nothing to count", async () => {
  const counts = await fetchDashboardCounts(client({ user_event_roles: { data: [], error: null } }), user, now);
  expect(counts).toEqual({ events: 0, projects: 0, feedback: 0 });
  expect(calls.some((c) => c.table === "events" || c.table === "feedback")).toBe(false);
});

it.each(["user_event_roles", "rpc", "events", "feedback"])("throws instead of showing 0 when %s fails", async (table) => {
  const ok = {
    user_event_roles: { data: [{ event_id: "e1" }], error: null },
    rpc: { data: ["p1"], error: null },
    events: { data: [], error: null },
    feedback: { count: 1, error: null },
  } as Record<string, Result>;
  ok[table] = { data: null, count: null, error: { message: "boom" } };
  await expect(fetchDashboardCounts(client(ok), user, now)).rejects.toBeTruthy();
});
