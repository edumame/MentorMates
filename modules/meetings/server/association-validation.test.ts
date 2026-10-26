/** @jest-environment node */
import { meetingsRouter } from "./procedures";
import { streamVideo } from "@/lib/stream-video";

jest.mock("@/trpc/init", () => {
  const { initTRPC } = jest.requireActual("@trpc/server");
  const t = initTRPC.create();
  return { createTRPCRouter: t.router, protectedProcedure: t.procedure };
});
jest.mock("@/lib/stream-video", () => ({ streamVideo: { video: { call: jest.fn() }, upsertUsers: jest.fn() } }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
const agent = "30000000-0000-4000-8000-000000000001";
const meeting = "40000000-0000-4000-8000-000000000001";
const event = "10000000-0000-4000-8000-000000000001";
const input = { name: "Session", agentId: agent, eventId: "", projectId: "" };
let rpc: jest.Mock;
let from: jest.Mock;
let update: jest.Mock;
let eqs: jest.Mock[];
let allowed: unknown;
let rpcError: unknown;
let existing: unknown;
let lookupError: unknown;
let create: jest.Mock;
function caller() { return meetingsRouter.createCaller({ supabase: { rpc, from }, auth: { user: { id: "user", user_metadata: {} } } } as never); }
beforeEach(() => {
  jest.clearAllMocks(); eqs = []; allowed = true; rpcError = null; lookupError = null;
  existing = { agent_id: agent, event_id: null, project_id: null };
  create = jest.fn().mockResolvedValue({});
  (streamVideo.video.call as jest.Mock).mockReturnValue({ create });
  (streamVideo.upsertUsers as jest.Mock).mockResolvedValue({});
  rpc = jest.fn(async (name) => ({ data: name === "is_admin_user" ? true : allowed, error: rpcError }));
  from = jest.fn(table => {
    const result = { data: table === "agents" ? [{ id: agent, name: "Agent" }] : [{ id: meeting, agent_id: agent }], error: null };
    const query: Record<string, jest.Mock> = {};
    for (const method of ["select","eq","match"]) query[method] = jest.fn(() => query);
    query.maybeSingle = jest.fn(async () => ({ data: existing, error: lookupError }));
    query.limit = jest.fn(async () => result);
    query.then = jest.fn(resolve => Promise.resolve(result).then(resolve));
    query.update = update = jest.fn(() => query);
    query.insert = jest.fn(() => query);
    eqs.push(query.eq);
    return query;
  });
});
it.each([false, null, "true"])("fails closed on association result %s before DB insert or Stream", async result => {
  allowed = result;
  await expect(caller().create(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(from).not.toHaveBeenCalled(); expect(streamVideo.video.call).not.toHaveBeenCalled();
});
it("hides validator failure details and never calls Stream", async () => {
  rpcError = { message: "private detail" };
  await expect(caller().create(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Unable to verify meeting associations" });
  expect(streamVideo.video.call).not.toHaveBeenCalled();
});
it.each([{ ...input, agentId: "not-uuid" }, { ...input, eventId: "wrong" }, { ...input, projectId: "wrong" }, { ...input, name: " " }, { ...input, name: "a".repeat(201) }])("rejects malformed create input before external effects", async value => {
  await expect(caller().create(value)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(rpc).not.toHaveBeenCalled(); expect(streamVideo.video.call).not.toHaveBeenCalled();
});
it("normalizes empty associations and validates before creating the stream call", async () => {
  await caller().create(input);
  expect(rpc.mock.calls[0]).toEqual(["meeting_associations_allowed", { p_agent: agent, p_event: null, p_project: null }]);
  expect(create).toHaveBeenCalledTimes(1);
});
it("preserves rename of historical associations without requiring agent revalidation", async () => {
  allowed = false;
  await caller().update({ ...input, id: meeting, name: "Renamed" });
  expect(rpc).not.toHaveBeenCalled(); expect(update).toHaveBeenCalled();
  expect(eqs[0]).toHaveBeenCalledWith("user_id", "user");
});
it("validates changed event association and refuses mutation on denial", async () => {
  allowed = false;
  await expect(caller().update({ ...input, id: meeting, eventId: event })).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(update).not.toHaveBeenCalled(); expect(streamVideo.video.call).not.toHaveBeenCalled();
});
it.each(["missing", "database-error"])("does not mutate if owner lookup is %s", async mode => {
  existing = null; lookupError = mode === "database-error" ? {} : null;
  await expect(caller().update({ ...input, id: meeting })).rejects.toMatchObject({ code: mode === "missing" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR" });
  expect(update).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});

it("permits a validated association change and keeps owner-scoped update", async () => {
  await caller().update({ ...input, id: meeting, eventId: event });
  expect(rpc).toHaveBeenCalledWith("meeting_associations_allowed", { p_agent: agent, p_event: event, p_project: null });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ event_id: event }));
  expect(streamVideo.video.call).not.toHaveBeenCalled();
});
