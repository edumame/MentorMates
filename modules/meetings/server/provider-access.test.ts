/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any -- focused query/provider boundary fakes */
import { meetingsRouter } from "./procedures";
import { streamVideo } from "@/lib/stream-video";
import { streamChat } from "@/lib/stream-chat";
jest.mock("@/lib/stream-video", () => ({ streamVideo: { upsertUsers: jest.fn(), generateCallToken: jest.fn(() => "video-token"), video: { call: jest.fn() } } }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: { upsertUsers: jest.fn(), queryChannels: jest.fn(), channel: jest.fn(), createToken: jest.fn(() => "chat-token") } }));
const mockVideo = streamVideo as unknown as { upsertUsers: jest.Mock; generateCallToken: jest.Mock; video: { call: jest.Mock } };
const mockChat = streamChat as unknown as { upsertUsers: jest.Mock; queryChannels: jest.Mock; channel: jest.Mock; createToken: jest.Mock };
jest.mock("@/trpc/init", () => {
  const { initTRPC, TRPCError } = jest.requireActual("@trpc/server");
  const t = initTRPC.create();
  return { createTRPCRouter: t.router, protectedProcedure: t.procedure.use(({ ctx, next }: any) => {
    if (!ctx.auth?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return next({ ctx });
  }) };
});
const id = "11111111-1111-4111-8111-111111111111";
let meeting: any;
let admin: unknown;
let eventOwner: string;
let role: string | null;
let failure: string | null;
let filters: Record<string, unknown>[];
let call: { get: jest.Mock; create: jest.Mock; updateCallMembers: jest.Mock };
let channel: { create: jest.Mock; addMembers: jest.Mock };
function caller(userId = "owner") {
  const supabase = {
    rpc: jest.fn(async () => ({ data: admin, error: failure === "admin" ? new Error("private DB detail") : null })),
    from: jest.fn((table: string) => {
      const f: Record<string, unknown> = { table }; filters.push(f);
      const q: any = { select: () => q, insert: () => q, eq: (key: string, value: unknown) => { f[key] = value; return q; }, in: (key: string, value: unknown) => { f[key] = value; return q; },
        maybeSingle: async () => ({ data: table === "meetings" ? meeting : table === "events" ? { owner_id: eventOwner } : role ? { role } : null, error: failure === table ? new Error("private DB detail") : null }),
        limit: async () => ({ data: table === "meetings" ? [meeting] : [{ id: "bot", name: "Bot" }], error: failure === "agents" ? new Error("agent failure") : null }),
      }; return q;
    }),
  };
  return meetingsRouter.createCaller({ auth: userId ? { user: { id: userId, user_metadata: {} } } : undefined, supabase } as any);
}
beforeEach(() => {
  jest.clearAllMocks(); meeting = { id, user_id: "owner", event_id: "event", agent_id: "bot" }; admin = false; eventOwner = "event-owner"; role = null; failure = null; filters = [];
  call = { get: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}), updateCallMembers: jest.fn().mockResolvedValue({}) };
  channel = { create: jest.fn().mockResolvedValue({}), addMembers: jest.fn().mockResolvedValue({}) };
  mockVideo.video.call.mockReturnValue(call); mockChat.queryChannels.mockResolvedValue([channel]); mockChat.channel.mockReturnValue(channel);
  mockVideo.upsertUsers.mockResolvedValue({}); mockChat.upsertUsers.mockResolvedValue({});
});
const endpoints = ["generateToken", "generateChatToken", "ensureCallExists"] as const;
function noProvider() { expect(mockVideo.video.call).not.toHaveBeenCalled(); expect(mockVideo.upsertUsers).not.toHaveBeenCalled(); expect(mockChat.upsertUsers).not.toHaveBeenCalled(); expect(mockChat.queryChannels).not.toHaveBeenCalled(); }
it.each(endpoints)("%s rejects missing auth and invalid UUID before provider", async endpoint => {
  await expect(caller("")[endpoint]({ id })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(caller()[endpoint]({ id: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" }); noProvider();
});
it.each(endpoints)("%s denies participant, outsider and standalone admin", async endpoint => {
  role = "participant"; await expect(caller("outsider")[endpoint]({ id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  role = null; await expect(caller("outsider")[endpoint]({ id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  meeting.event_id = null; admin = true; await expect(caller("outsider")[endpoint]({ id })).rejects.toMatchObject({ code: "FORBIDDEN" }); noProvider();
});
it.each(endpoints)("%s permits owner, event owner, event management and platform admin", async endpoint => {
  for (const user of ["owner", "event-owner"]) await caller(user)[endpoint]({ id });
  for (const management of ["organizer", "admin"]) { role = management; await caller("manager")[endpoint]({ id }); }
  expect(filters).toContainEqual(expect.objectContaining({ table: "user_event_roles", event_id: "event", user_id: "manager", role: ["organizer", "admin"] }));
  role = null; admin = true; await caller("platform")[endpoint]({ id });
});
it.each(endpoints)("%s fails closed on each lookup error or missing meeting", async endpoint => {
  for (const table of ["meetings", "admin", "events", "user_event_roles"]) {
    failure = table; await expect(caller("outsider")[endpoint]({ id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Unable to verify meeting access" });
  }
  failure = null; meeting = null; await expect(caller()[endpoint]({ id })).rejects.toMatchObject({ code: "NOT_FOUND" }); noProvider();
});
it("rejects truthy nonboolean admin results", async () => { admin = "true"; await expect(caller("outsider").generateToken({ id })).rejects.toMatchObject({ code: "FORBIDDEN" }); noProvider(); });
it("mints ordinary human, 15-minute call token with correct issued-at", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  expect(await caller().generateToken({ id })).toBe("video-token");
  expect(mockVideo.upsertUsers).toHaveBeenCalledWith([expect.objectContaining({ id: "owner", role: "user" })]);
  expect(mockVideo.generateCallToken).toHaveBeenCalledWith({ user_id: "owner", call_cids: [`default:${id}`], exp: 1700000900, iat: 1700000000 }); jest.restoreAllMocks();
});
it("provisions Chat membership before expiring token and repeats safely", async () => {
  mockChat.queryChannels.mockResolvedValueOnce([]);
  await caller().generateChatToken({ id }); await caller().generateChatToken({ id });
  expect(channel.create).toHaveBeenCalledTimes(1); expect(channel.addMembers).toHaveBeenCalledTimes(2);
  expect(channel.addMembers).toHaveBeenCalledWith(["owner"]);
  expect(mockChat.upsertUsers).toHaveBeenCalledWith([{ id: "owner", role: "user" }]);
  expect(mockChat.queryChannels).toHaveBeenCalledWith({ cid: { $eq: `messaging:${id}` } }, [], { limit: 1, watch: false, state: false });
  const [user, exp, iat] = mockChat.createToken.mock.calls[0] as unknown as [string, number, number]; expect(user).toBe("owner"); expect(exp-iat).toBe(900);
  expect(channel.addMembers.mock.invocationCallOrder[0]).toBeLessThan(mockChat.createToken.mock.invocationCallOrder[0]);
});
it.each([403, 429, 500])("Chat lookup %s cannot create channel or issue token", async status => {
  mockChat.queryChannels.mockRejectedValue({ status }); await expect(caller().generateChatToken({ id })).rejects.toBeDefined();
  expect(channel.create).not.toHaveBeenCalled(); expect(mockChat.createToken).not.toHaveBeenCalled();
});
it.each(["create", "addMembers"] as const)("Chat %s failure cannot issue token", async action => {
  mockChat.queryChannels.mockResolvedValue([]); channel[action].mockRejectedValue(new Error("provider failure"));
  await expect(caller().generateChatToken({ id })).rejects.toBeDefined(); expect(mockChat.createToken).not.toHaveBeenCalled();
});
it.each([403, 429, 500, undefined])("Video lookup %s never triggers creation", async responseCode => {
  call.get.mockRejectedValue({ metadata: { responseCode } }); await expect(caller().ensureCallExists({ id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(call.create).not.toHaveBeenCalled();
});
it("only confirmed Video404 creates and repeat lookup does not recreate", async () => {
  call.get.mockRejectedValueOnce({ metadata: { responseCode: 404 } });
  expect(await caller().ensureCallExists({ id })).toEqual({ created: true });
  expect(await caller().ensureCallExists({ id })).toEqual({ created: false }); expect(call.create).toHaveBeenCalledTimes(1);
});

it("Video membership failure prevents token issuance", async () => {
  call.updateCallMembers.mockRejectedValue(new Error("membership failed"));
  await expect(caller().generateToken({ id })).rejects.toBeDefined(); expect(mockVideo.generateCallToken).not.toHaveBeenCalled();
});
it("ensure provisions ordinary caller membership for existing and new calls", async () => {
  await caller().ensureCallExists({ id }); call.get.mockRejectedValueOnce({ metadata: { responseCode: 404 } });
  await caller().ensureCallExists({ id }); expect(call.updateCallMembers).toHaveBeenCalledTimes(2);
  expect(call.updateCallMembers).toHaveBeenCalledWith({ update_members: [{ user_id: "owner" }] });
  expect(mockVideo.upsertUsers).toHaveBeenCalledWith([{ id: "owner", role: "user" }]);
});

it.each(["upsert", "membership", "token"])("Video %s failure redacts upstream details", async stage => {
  const canary = "secret-provider-canary";
  if (stage === "upsert") mockVideo.upsertUsers.mockRejectedValueOnce(new Error(canary));
  if (stage === "membership") call.updateCallMembers.mockRejectedValueOnce(new Error(canary));
  if (stage === "token") mockVideo.generateCallToken.mockImplementationOnce(() => { throw new Error(canary); });
  await expect(caller().generateToken({ id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare meeting provider access" });
});
it.each(["upsert", "query", "create", "membership", "token"])("Chat %s failure redacts upstream details", async stage => {
  const error = new Error("secret-provider-canary");
  if (stage === "upsert") mockChat.upsertUsers.mockRejectedValueOnce(error);
  if (stage === "query") mockChat.queryChannels.mockRejectedValueOnce(error);
  if (stage === "create") { mockChat.queryChannels.mockResolvedValueOnce([]); channel.create.mockRejectedValueOnce(error); }
  if (stage === "membership") channel.addMembers.mockRejectedValueOnce(error);
  if (stage === "token") mockChat.createToken.mockImplementationOnce(() => { throw error; });
  await expect(caller().generateChatToken({ id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare meeting provider access" });
});
it.each(["upsert", "create", "bot", "membership"])("ensure %s failure redacts upstream details", async stage => {
  const error = new Error("secret-provider-canary");
  if (stage === "upsert") mockVideo.upsertUsers.mockRejectedValueOnce(error);
  if (stage === "create" || stage === "bot") call.get.mockRejectedValueOnce({ metadata: { responseCode: 404 } });
  if (stage === "create") call.create.mockRejectedValueOnce(error);
  if (stage === "bot") mockVideo.upsertUsers.mockResolvedValueOnce({}).mockRejectedValueOnce(error);
  if (stage === "membership") call.updateCallMembers.mockRejectedValueOnce(error);
  await expect(caller().ensureCallExists({ id })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare meeting provider access" });
});

it("first-time meeting creation registers ordinary human before provider call creation", async () => {
  admin = true; // Session cap branch is unchanged; isolate provider bootstrap.
  await caller().create({ name: "New meeting", agentId: "bot" });
  expect(mockVideo.upsertUsers).toHaveBeenNthCalledWith(1, [{ id: "owner", role: "user" }]);
  expect(mockVideo.upsertUsers.mock.invocationCallOrder[0]).toBeLessThan(call.create.mock.invocationCallOrder[0]);
  expect(call.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ created_by_id: "owner", members: [{ user_id: "owner" }] }) }));
});
