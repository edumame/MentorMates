import Page from "./page";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getEventForRoute } from "@/lib/events/server-event";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/events/server-event", () => ({ getEventForRoute: jest.fn() }));
jest.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
jest.mock("@/components/events/event-page-layout", () => ({ EventPageLayout: () => null }));
jest.mock("@/components/events/event-page-content", () => ({ EventPageContent: () => null }));
jest.mock("@/components/events/event-page-sidebar", () => ({ EventPageSidebar: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function setup(user: { id: string; email: string } | null) {
  const started: string[] = [];
  const pending = new Map<string, ReturnType<typeof deferred<{ data: unknown }>>>();
  const filters: Record<string, unknown[][]> = {};
  let roleCalls = 0;
  const from = jest.fn((table: string) => {
    const key = table === "user_event_roles" ? (roleCalls++ === 0 ? "judges" : "membership") : table;
    const wait = deferred<{ data: unknown }>();
    pending.set(key, wait);
    filters[key] = [];
    const query: { select: jest.Mock; eq: jest.Mock; in: jest.Mock; maybeSingle: jest.Mock; then: (resolve: (value: { data: unknown }) => void, reject: (reason: unknown) => void) => Promise<void> } = {
      select: jest.fn(() => query),
      eq: jest.fn((...args: unknown[]) => { filters[key].push(args); return query; }),
      in: jest.fn((...args: unknown[]) => { filters[key].push(args); return query; }),
      maybeSingle: jest.fn(() => query),
      then: (resolve: (value: { data: unknown }) => void, reject: (reason: unknown) => void) => {
        started.push(key);
        return wait.promise.then(resolve, reject);
      },
    };
    return query;
  });
  const event = Object.freeze({ event_id: "event-1", event_name: "Event", slug: "event" });
  jest.mocked(getEventForRoute).mockResolvedValue({ data: event, error: null } as never);
  // my_project_ids resolves the caller's projects (team email columns are not
  // client-readable); get_event_paywall_content returns the member content.
  const rpc = jest.fn(async (name: string) =>
    name === "my_project_ids" ? { data: ["project-1"], error: null } : { data: "MEMBER-SECRET", error: null });
  jest.mocked(createSupabaseClient).mockResolvedValue({ from, rpc, auth: { getUser: jest.fn(async () => ({ data: { user } })) } } as never);
  return { started, pending, filters, event, from, rpc };
}

it("starts independent resources together and starts both user lookups together", async () => {
  const state = setup({ id: "user-1", email: "owner@example.test" });
  const rendering = Page({ params: Promise.resolve({ id: "event" }) });
  await flush();
  expect(state.started.sort()).toEqual(["event_lessons", "event_tracks", "judges"]);
  state.pending.get("event_tracks")!.resolve({ data: [] });
  state.pending.get("event_lessons")!.resolve({ data: [{ title: "Lesson" }] });
  state.pending.get("judges")!.resolve({ data: [] });
  await flush();
  expect(state.started).toEqual(expect.arrayContaining(["membership", "projects"]));
  expect(state.filters.membership).toEqual([["user_id", "user-1"], ["event_id", "event-1"]]);
  expect(state.rpc).toHaveBeenCalledWith("my_project_ids", { p_event_id: "event-1" });
  expect(state.filters.projects).toEqual([["id", ["project-1"]]]);
  state.pending.get("membership")!.resolve({ data: { role: "organizer" } });
  state.pending.get("projects")!.resolve({ data: [] });
  const result = await rendering;
  expect(state.rpc).toHaveBeenCalledWith("get_event_paywall_content", { p_event_id: "event-1" });
  expect(result.props.hasJoined).toBe(true);
  expect(contentEvent(result).paywall_content).toBe("MEMBER-SECRET");
  expect(state.event).not.toHaveProperty("event_lessons");
});

// PUB-002: member-only content must not be fetched or serialized for non-members.
it("does not fetch or pass paywall content for a signed-in non-member", async () => {
  const state = setup({ id: "outsider", email: "outsider@example.test" });
  const rendering = Page({ params: Promise.resolve({ id: "event" }) });
  await flush();
  for (const key of ["event_tracks", "event_lessons", "judges"]) state.pending.get(key)!.resolve({ data: [] });
  await flush();
  state.pending.get("membership")!.resolve({ data: null });
  state.pending.get("projects")!.resolve({ data: [] });
  const result = await rendering;
  expect(result.props.hasJoined).toBe(false);
  expect(state.rpc).not.toHaveBeenCalledWith("get_event_paywall_content", expect.anything());
  expect(contentEvent(result).paywall_content).toBeUndefined();
});

function contentEvent(result: { props: { children: Array<{ props: { children: { props: { event: { paywall_content?: string } } } } }> } }) {
  return result.props.children[0].props.children.props.event;
}

it("does not query private user resources for a signed-out visitor", async () => {
  const state = setup(null);
  const rendering = Page({ params: Promise.resolve({ id: "event" }) });
  await flush();
  for (const pending of state.pending.values()) pending.resolve({ data: null });
  const result = await rendering;
  expect(result.props.hasJoined).toBe(false);
  expect(state.started).toHaveLength(3);
  expect(contentEvent(result).paywall_content).toBeUndefined();
});

it("stops before ancillary queries for an inaccessible or missing event", async () => {
  const state = setup(null);
  jest.mocked(getEventForRoute).mockResolvedValue({ data: null, error: null } as never);
  await expect(Page({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NOT_FOUND");
  expect(state.from).not.toHaveBeenCalled();
});
