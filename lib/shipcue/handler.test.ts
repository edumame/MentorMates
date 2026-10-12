/** @jest-environment node */
import { memoryStore, type ReportStore } from "shipcue/server";
import {
  createMentorMatesShipcueHandler,
  reporterOf,
  type ShipcueDeps,
  type ShipcueUser,
} from "@/lib/shipcue/handler";

const BASE = "http://localhost/api/shipcue";
const TOKEN = "test-token";
const ALICE: ShipcueUser = { id: "u-alice", email: "alice@example.com" };
const ADMIN: ShipcueUser = { id: "u-admin", email: "admin@mentormates.ai" };

function reportForm(fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("type", "bug");
  form.set("priority", "medium");
  form.set("area", "events");
  form.set("description", "The schedule tab shows the wrong timezone.");
  form.set("pageUrl", "https://mentormates.ai/events/1/schedule");
  form.set("userAgent", "jest");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

function setup(user: ShipcueUser | null, opts: Partial<ShipcueDeps> = {}) {
  const store: ReportStore = memoryStore();
  const onReport = jest.fn().mockResolvedValue(undefined);
  const isAdmin = jest.fn(async (id: string) => id === ADMIN.id);
  const getUser = jest.fn(async () => user);
  const handler = createMentorMatesShipcueHandler({
    store,
    getUser,
    isAdmin,
    agentToken: TOKEN,
    onReport,
    ...opts,
  });
  const file = (fields?: Record<string, string>) =>
    handler(new Request(`${BASE}/reports`, { method: "POST", body: reportForm(fields) }));
  const agent = (path: string, init: RequestInit = {}, token: string | null = TOKEN) =>
    handler(
      new Request(`${BASE}${path}`, {
        ...init,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
        },
      })
    );
  return { store, handler, file, agent, onReport, isAdmin, getUser };
}

describe("reporterOf", () => {
  it("uses the email, falls back to the user id, and is null when signed out", () => {
    expect(reporterOf(ALICE)).toBe("alice@example.com");
    expect(reporterOf({ id: "u-1", email: null })).toBe("u-1");
    expect(reporterOf(null)).toBeNull();
  });
});

describe("filing reports through /api/shipcue/reports", () => {
  it("files a signed-in user's bug with their email as reporter and tells the team", async () => {
    const { file, store, onReport, getUser } = setup(ALICE);
    const res = await file({ context: "Schedule: 9:00 PM PDT" });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const saved = await store.get(id);
    expect(saved).toMatchObject({
      type: "bug",
      area: "events",
      reporter: "alice@example.com",
      status: "open",
      context: "Schedule: 9:00 PM PDT",
    });
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id }));
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("accepts bugs and feature requests from signed-out visitors, with no reporter", async () => {
    const { file, store } = setup(null);
    const bug = await file();
    const feature = await file({ type: "feature", area: "projects" });
    expect(bug.status).toBe(201);
    expect(feature.status).toBe(201);
    const reports = await store.list();
    expect(reports.map((r) => r.reporter)).toEqual([null, null]);
  });

  it("turns away a signed-out agent task", async () => {
    const { file, store } = setup(null);
    const res = await file({ type: "task" });
    expect(res.status).toBe(401);
    expect(await store.list()).toHaveLength(0);
  });

  it("turns away an agent task from a signed-in non-admin", async () => {
    const { file, store, isAdmin } = setup(ALICE);
    const res = await file({ type: "task" });
    expect(res.status).toBe(403);
    expect(isAdmin).toHaveBeenCalledWith(ALICE.id);
    expect(await store.list()).toHaveLength(0);
  });

  it("treats a failing admin check as not an admin", async () => {
    const { file } = setup(ALICE, { isAdmin: jest.fn().mockRejectedValue(new Error("rpc down")) });
    expect((await file({ type: "task" })).status).toBe(403);
  });

  it("files an admin's agent task", async () => {
    const { file, store } = setup(ADMIN);
    const res = await file({ type: "task", description: "Add a CSV export to the judges table." });
    expect(res.status).toBe(201);
    const [task] = await store.list();
    expect(task).toMatchObject({ type: "task", reporter: ADMIN.email });
  });

  it("rejects an area MentorMates does not have", async () => {
    const { file } = setup(ALICE);
    const res = await file({ area: "billing-v2" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/where it happened/i);
  });

  it("accepts every MentorMates area and Other", async () => {
    const { file } = setup(ALICE);
    for (const area of ["events", "projects", "judging", "dashboard", "admin", "other"]) {
      expect((await file({ area })).status).toBe(201);
    }
  });

  it("still files the report when a signed-out session lookup throws", async () => {
    const { file, store } = setup(null, { getUser: jest.fn().mockRejectedValue(new Error("cookies")) });
    expect((await file()).status).toBe(201);
    expect((await store.list())[0].reporter).toBeNull();
  });
});

describe("the agent API", () => {
  it("is switched off when SHIPCUE_TOKEN is unset", async () => {
    const { agent } = setup(null, { agentToken: undefined });
    expect((await agent("/reports")).status).toBe(404);
  });

  it("refuses a missing or wrong bearer token", async () => {
    const { agent } = setup(null);
    expect((await agent("/reports", {}, null)).status).toBe(401);
    expect((await agent("/reports", {}, "nope")).status).toBe(401);
  });

  it("lists the queue, hands out the most urgent report, and closes it", async () => {
    const { file, agent } = setup(ALICE);
    await file({ priority: "low", description: "Low priority thing to fix." });
    await file({ priority: "blocking", description: "Judges cannot submit scores at all." });

    const list = await agent("/reports?status=open");
    expect(list.status).toBe(200);
    expect((await list.json()).reports).toHaveLength(2);

    const claimed = await agent("/reports/next/claim", {
      method: "POST",
      body: JSON.stringify({ agent: "claude" }),
    });
    expect(claimed.status).toBe(200);
    const { report, prompt } = await claimed.json();
    expect(report).toMatchObject({ priority: "blocking", status: "claimed", claimedBy: "claude" });
    expect(prompt).toContain("Judges cannot submit scores at all.");

    const again = await agent(`/reports/${report.id}/claim`, { method: "POST", body: "{}" });
    expect(again.status).toBe(409);

    const closed = await agent(`/reports/${report.id}/close`, {
      method: "POST",
      body: JSON.stringify({ status: "fixed", resolution: "https://github.com/edumame/MentorMates/pull/1" }),
    });
    expect(closed.status).toBe(200);
    expect((await closed.json()).report).toMatchObject({ status: "fixed" });
  });
});
