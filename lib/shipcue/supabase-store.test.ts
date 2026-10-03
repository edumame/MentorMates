/** @jest-environment node */
import { supabaseStore } from "@/lib/shipcue/supabase-store";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

const ID = "3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  type: "bug",
  priority: "high",
  area: "judging",
  description: "Scores do not save.",
  page_url: "https://mentormates.ai/events/1/voting",
  user_agent: "jest",
  diagnostics: { route: "/events/1/voting" },
  screenshots: ["https://cdn/x.png"],
  reporter: "pat@example.com",
  status: "open",
  claimed_by: null,
  claimed_at: null,
  resolution: null,
  video: null,
  context: "Score: 7",
  created_at: "2026-10-01T10:00:00+00:00",
  ...over,
});

type Call = [string, unknown[]];
type Result = { data: unknown; error: { message: string } | null };

/** A PostgREST-shaped fake: records the chain, resolves with `result`. */
function fakeClient(result: Result) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "insert", "update", "eq", "is", "order"]) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return chain;
    };
  }
  for (const name of ["single", "maybeSingle"]) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return Promise.resolve(result);
    };
  }
  chain.then = (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve);
  const client = {
    from: (table: string) => {
      calls.push(["from", [table]]);
      return chain;
    },
    rpc: jest.fn(async (fn: string, args: unknown) => {
      calls.push(["rpc", [fn, args]]);
      return result;
    }),
  };
  return { client: client as unknown as ServiceSupabaseClient, calls };
}

const named = (calls: Call[], name: string) => calls.filter(([n]) => n === name).map(([, a]) => a);

describe("supabaseStore", () => {
  it("creates a report and maps the row to shipcue's shape", async () => {
    const { client, calls } = fakeClient({ data: row(), error: null });
    const report = await supabaseStore(client).create({
      type: "bug",
      priority: "high",
      area: "judging",
      description: "Scores do not save.",
      pageUrl: "https://mentormates.ai/events/1/voting",
      userAgent: "jest",
      diagnostics: { route: "/events/1/voting" },
      screenshots: ["https://cdn/x.png"],
      reporter: "pat@example.com",
      context: "Score: 7",
    });
    expect(named(calls, "from")).toEqual([["shipcue_reports"]]);
    expect(named(calls, "insert")[0][0]).toMatchObject({
      page_url: "https://mentormates.ai/events/1/voting",
      user_agent: "jest",
      reporter: "pat@example.com",
      context: "Score: 7",
    });
    expect(report).toEqual({
      id: ID,
      type: "bug",
      priority: "high",
      area: "judging",
      description: "Scores do not save.",
      pageUrl: "https://mentormates.ai/events/1/voting",
      userAgent: "jest",
      diagnostics: { route: "/events/1/voting" },
      screenshots: ["https://cdn/x.png"],
      reporter: "pat@example.com",
      status: "open",
      createdAt: "2026-10-01T10:00:00.000Z",
      claimedBy: null,
      claimedAt: null,
      resolution: null,
      video: null,
      context: "Score: 7",
    });
  });

  it("throws when the insert fails so the handler answers 500", async () => {
    const { client } = fakeClient({ data: null, error: { message: "relation does not exist" } });
    await expect(
      supabaseStore(client).create({
        type: "bug",
        priority: "low",
        area: "other",
        description: "x",
        pageUrl: "",
        userAgent: "",
        diagnostics: {},
        screenshots: [],
        reporter: null,
      })
    ).rejects.toThrow(/relation does not exist/);
  });

  it("hides soft-deleted rows and ignores ids that are not uuids", async () => {
    const { client, calls } = fakeClient({ data: row(), error: null });
    const store = supabaseStore(client);
    expect(await store.get("next")).toBeNull();
    expect(calls).toHaveLength(0);
    await store.get(ID);
    expect(named(calls, "eq")).toEqual([
      ["id", ID],
      ["is_deleted", false],
    ]);
  });

  it("lists in queue order: most urgent, then oldest", async () => {
    const { client, calls } = fakeClient({ data: [row(), row({ id: "b" })], error: null });
    const reports = await supabaseStore(client).list({ status: "open" });
    expect(reports).toHaveLength(2);
    expect(named(calls, "eq")).toEqual([
      ["is_deleted", false],
      ["status", "open"],
    ]);
    expect(named(calls, "order")).toEqual([
      ["priority_rank", { ascending: false }],
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });

  it("takes the next report through the SKIP LOCKED SQL function", async () => {
    const { client, calls } = fakeClient({
      data: [row({ status: "claimed", claimed_by: "claude", claimed_at: "2026-10-01T11:00:00Z" })],
      error: null,
    });
    const report = await supabaseStore(client).claimNext("claude");
    expect(named(calls, "rpc")).toEqual([["shipcue_claim_next", { p_agent: "claude" }]]);
    expect(report).toMatchObject({ status: "claimed", claimedBy: "claude" });
  });

  it("returns null when the queue is empty", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await supabaseStore(client).claimNext("claude")).toBeNull();
  });

  it("claims only an open report, in one conditional update", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    expect(await supabaseStore(client).claim(ID, "codex")).toBeNull();
    expect(named(calls, "update")[0][0]).toMatchObject({ status: "claimed", claimed_by: "codex" });
    expect(named(calls, "eq")).toEqual([
      ["id", ID],
      ["status", "open"],
      ["is_deleted", false],
    ]);
  });

  it("keeps the claimant's name when shipcue 0.13+ passes a person or an agent", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await supabaseStore(client).claim(ID, { kind: "person", id: "pat@example.com", name: "Pat" });
    expect(named(calls, "update")[0][0]).toMatchObject({ status: "claimed", claimed_by: "Pat" });
    const next = fakeClient({ data: [], error: null });
    await supabaseStore(next.client).claimNext({ kind: "agent", id: "claude-code", name: "claude-code" });
    expect(named(next.calls, "rpc")).toEqual([["shipcue_claim_next", { p_agent: "claude-code" }]]);
  });

  it("releases only a claimed report", async () => {
    const { client, calls } = fakeClient({ data: row(), error: null });
    await supabaseStore(client).release(ID);
    expect(named(calls, "update")[0][0]).toMatchObject({ status: "open", claimed_by: null, claimed_at: null });
    expect(named(calls, "eq")).toContainEqual(["status", "claimed"]);
  });

  it("closes with a status and resolution", async () => {
    const { client, calls } = fakeClient({ data: row({ status: "fixed", resolution: "PR #9" }), error: null });
    const report = await supabaseStore(client).close(ID, "fixed", "PR #9");
    expect(named(calls, "update")[0][0]).toMatchObject({ status: "fixed", resolution: "PR #9" });
    expect(report).toMatchObject({ status: "fixed", resolution: "PR #9" });
  });

  it("attaches a video only when the report has none", async () => {
    const { client, calls } = fakeClient({ data: row({ video: "https://cdn/v.webm" }), error: null });
    const report = await supabaseStore(client).attachVideo(ID, "https://cdn/v.webm");
    expect(named(calls, "is")).toEqual([["video", null]]);
    expect(report?.video).toBe("https://cdn/v.webm");
  });
});
