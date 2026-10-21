/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST as submit } from "./route";
import { POST as hasMessages } from "../has-user-messages/route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { streamChat } from "@/lib/stream-chat";
import { inngest } from "@/lib/inngest/client";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/stream-chat", () => ({ streamChat: { channel: jest.fn() } }));
jest.mock("@/lib/inngest/client", () => ({ inngest: { send: jest.fn() } }));

const id = "123e4567-e89b-42d3-a456-426614174000";
let meeting: Record<string, unknown>;
let currentUser: string | null;
let admin: boolean;
let owner: string;
let role: string | null;
let roleEvent: string;
let roleUser: string;
let missingMeeting: boolean;
let failedTable: string | null;
let claimError: boolean;
let releaseError: boolean;
let authError: boolean;
let adminError: boolean;
let updates: Array<Record<string, unknown>>;
let query: jest.Mock;
const request = (body: unknown = { meetingId: id }) => new NextRequest("http://localhost/api/meetings", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  meeting = { id, user_id: "owner", event_id: "event", agent_id: "agent", status: "upcoming", ended_at: null, updated_at: null };
  roleEvent = "event"; roleUser = "other"; missingMeeting = false;
  currentUser = "owner"; admin = false; owner = "event-owner"; role = null;
  failedTable = null; claimError = false; releaseError = false; authError = false; adminError = false; updates = [];
  query = jest.fn().mockResolvedValue({ messages: [{ text: "Hello", user: { id: "owner" } }] });
  (streamChat.channel as jest.Mock).mockReturnValue({ query });
  (inngest.send as jest.Mock).mockResolvedValue({ ids: ["event"] });
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUser ? { id: currentUser } : null }, error: authError ? {} : null })) },
    rpc: jest.fn(async () => ({ data: admin, error: adminError ? {} : null })),
  });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> | undefined;
      const builder: { select: jest.Mock; eq: jest.Mock; in: jest.Mock; update: jest.Mock; maybeSingle: jest.Mock } = {
        select: jest.fn(() => builder),
        eq: jest.fn((key: string, value: unknown) => { filters[key] = value; return builder; }),
        in: jest.fn(() => builder),
        update: jest.fn((value: Record<string, unknown>) => { patch = value; return builder; }),
        maybeSingle: jest.fn(async () => {
          if (failedTable === table) return { data: null, error: { message: "database failure" } };
          if (table === "events") return { data: { owner_id: owner }, error: null };
          if (table === "user_event_roles") return { data: role && filters.event_id === roleEvent && filters.user_id === roleUser ? { role } : null, error: null };
          if (!patch) return { data: missingMeeting ? null : { ...meeting }, error: null };
          if ((patch.status === "processing" && claimError) || (patch.status === "upcoming" && releaseError)) return { data: null, error: {} };
          // Model UPDATE WHERE predicates atomically at execution, not at read time.
          if (!Object.entries(filters).every(([key, value]) => meeting[key] === value)) return { data: null, error: null };
          updates.push(patch); Object.assign(meeting, patch);
          return { data: { id }, error: null };
        }),
      };
      return builder;
    }),
  });
});

for (const [name, handler] of [["submit", submit], ["has-messages", hasMessages]] as const) {
  describe(name, () => {
    it.each([{}, { meetingId: "x" }, { meetingId: "a".repeat(37) }, { meetingId: [] }])("rejects invalid IDs %j", async (body) => {
      expect((await handler(request(body))).status).toBe(400);
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
      expect(streamChat.channel).not.toHaveBeenCalled();
    });
    it("rejects malformed JSON", async () => {
      expect((await handler(new NextRequest("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    });
    it.each([false, true])("rejects absent/invalid authentication before privileged lookup (error=%s)", async (error) => {
      currentUser = error ? "owner" : null; authError = error;
      expect((await handler(request())).status).toBe(401);
      expect(createSupabaseServiceClient).not.toHaveBeenCalled();
      expect(streamChat.channel).not.toHaveBeenCalled();
    });
    it.each(["outsider", "participant", "mentor", "judge"])("denies %s without upstream work", async (value) => {
      currentUser = "other"; role = value === "outsider" ? null : value;
      expect((await handler(request())).status).toBe(403);
      expect(streamChat.channel).not.toHaveBeenCalled();
      expect(inngest.send).not.toHaveBeenCalled(); expect(updates).toEqual([]);
    });
    it.each(["meeting-owner", "event-owner", "organizer", "event-admin", "platform-admin"])("permits %s", async (value) => {
      currentUser = value === "meeting-owner" ? "owner" : "other";
      if (value === "event-owner") owner = "other";
      if (value === "organizer") role = "organizer";
      if (value === "event-admin") role = "admin";
      if (value === "platform-admin") admin = true;
      expect((await handler(request())).status).toBe(200);
    });
    it("denies platform admin access to another user's standalone meeting", async () => {
      meeting.event_id = null; currentUser = "other"; admin = true;
      expect((await handler(request())).status).toBe(403);
      expect(streamChat.channel).not.toHaveBeenCalled();
    });
    it("returns 404 for a missing meeting without upstream work", async () => {
      missingMeeting = true;
      expect((await handler(request())).status).toBe(404);
      expect(streamChat.channel).not.toHaveBeenCalled(); expect(updates).toEqual([]);
    });
    it.each(["event", "user"])("rejects an organizer role belonging to another %s", async mismatch => {
      currentUser = "other"; role = "organizer";
      if (mismatch === "event") roleEvent = "unrelated-event";
      else roleUser = "unrelated-user";
      expect((await handler(request())).status).toBe(403);
      expect(streamChat.channel).not.toHaveBeenCalled(); expect(updates).toEqual([]);
    });
    it("ignores a spoofed caller identity in the request body", async () => {
      currentUser = "other";
      expect((await handler(request({ meetingId: id, userId: "owner" }))).status).toBe(403);
      expect(streamChat.channel).not.toHaveBeenCalled();
    });
    it.each(["meetings", "events", "user_event_roles", "admin-rpc"])("fails closed on %s errors", async (table) => {
      currentUser = "other"; failedTable = table; adminError = table === "admin-rpc";
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      expect((await handler(request())).status).toBe(500);
      expect(streamChat.channel).not.toHaveBeenCalled(); expect(updates).toEqual([]);
      spy.mockRestore();
    });
  });
}

it("claims only once across concurrent submissions and emits stable job identity", async () => {
  const responses = await Promise.all([submit(request()), submit(request())]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(query).toHaveBeenCalledTimes(1); expect(inngest.send).toHaveBeenCalledTimes(1);
  expect(inngest.send).toHaveBeenCalledWith({ id: `meeting-transcript-${id}`, name: "meetings/processing", data: { meetingId: id, agentId: "agent", transcriptText: '{"speaker_id":"owner","text":"Hello"}' } });
  expect((await submit(request())).status).toBe(202);
  expect(inngest.send).toHaveBeenCalledTimes(1);
});
it.each(["completed", "processing"])("does not resubmit %s", async status => {
  meeting.status = status; expect((await submit(request())).status).toBe(202);
  expect(streamChat.channel).not.toHaveBeenCalled(); expect(updates).toEqual([]);
});
it.each(["active", "cancelled", null])("does not claim unsupported status %s", async status => {
  meeting.status = status; expect((await submit(request())).status).toBe(409);
  expect(streamChat.channel).not.toHaveBeenCalled();
});
it("does no upstream work if claim update fails", async () => {
  claimError = true;
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await submit(request())).status).toBe(500);
  expect(streamChat.channel).not.toHaveBeenCalled(); expect(inngest.send).not.toHaveBeenCalled(); spy.mockRestore();
});
it.each(["empty", "query failure"])("releases claim before enqueue for %s, permitting retry", async failure => {
  if (failure === "empty") query.mockResolvedValueOnce({ messages: [] });
  else query.mockRejectedValueOnce(new Error("chat offline"));
  expect((await submit(request())).status).toBe(503);
  expect(meeting.status).toBe("upcoming"); expect(meeting.ended_at).toBeNull(); expect(inngest.send).not.toHaveBeenCalled();
  expect((await submit(request())).status).toBe(200);
});
it("reports failed claim release without dispatching", async () => {
  releaseError = true; query.mockRejectedValueOnce(new Error("chat offline"));
  const response = await submit(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toContain("reconciliation");
  expect(meeting.status).toBe("processing"); expect(inngest.send).not.toHaveBeenCalled();
});
it("retains claim after uncertain delivery rather than starting duplicate work", async () => {
  (inngest.send as jest.Mock).mockRejectedValueOnce(new Error("connection reset after delivery"));
  const response = await submit(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toContain("uncertain");
  expect(meeting.status).toBe("processing"); expect((await submit(request())).status).toBe(202);
  expect(inngest.send).toHaveBeenCalledTimes(1);
});
it("counts only caller's nonblank messages after access verification", async () => {
  query.mockResolvedValue({ messages: [{ text: "hello", user: { id: "owner" } }, { text: " ", user: { id: "owner" } }, { text: "other", user: { id: "other" } }] });
  const response = await hasMessages(request());
  expect(await response.json()).toEqual({ hasUserMessages: true, count: 1 });
  expect(updates).toEqual([]); expect(inngest.send).not.toHaveBeenCalled();
});

it("bounds the actual body without trusting Content-Length", async () => {
  const response = await submit(request({ meetingId: id, extra: "a".repeat(5000) }));
  expect(response.status).toBe(413);
  expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
it("authenticates before reading an anonymous request body", async () => {
  currentUser = null;
  const req = request();
  const read = jest.spyOn(req.body!, "getReader");
  expect((await submit(req)).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
});
it("preserves an existing meeting end time on successful submission", async () => {
  const endedAt = "2026-01-01T12:00:00.000Z";
  meeting.ended_at = endedAt;
  expect((await submit(request())).status).toBe(200);
  expect(meeting.ended_at).toBe(endedAt);
});
it("does not release a claim that was completed by other work", async () => {
  query.mockImplementation(async () => { meeting.status = "completed"; throw new Error("chat unavailable"); });
  const response = await submit(request());
  expect(response.status).toBe(503);
  expect(meeting.status).toBe("completed");
  expect(inngest.send).not.toHaveBeenCalled();
});

it("returns a generic error when the authorized message lookup fails", async () => {
  query.mockRejectedValueOnce(new Error("private upstream credential detail"));
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const response = await hasMessages(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Unable to fetch messages" });
  expect(updates).toEqual([]); expect(inngest.send).not.toHaveBeenCalled();
  spy.mockRestore();
});
