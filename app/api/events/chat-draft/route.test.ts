/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { emptyDraft } from "@/lib/events/chat-draft";
import { DRAFT_CHAT_LIMITS } from "@/lib/events/chat-draft-prompt";
import { reserveEventChatTurn } from "@/lib/events/chat-quota";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/events/chat-quota", () => ({
  reserveEventChatTurn: jest.fn(),
}));

const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const LA = "America/Los_Angeles";
const realFetch = global.fetch;

function signedIn(user: { id: string } | null = { id: "user-1" }) {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

function request(body: unknown) {
  return new Request("http://localhost/api/events/chat-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function modelSays(reply: string, patch: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ reply, patch }) } }] });
}

describe("POST /api/events/chat-draft", () => {
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    signedIn();
    (reserveEventChatTurn as jest.Mock).mockResolvedValue({ allowed: true, retry_after_seconds: 0 });
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = prevKey;
    global.fetch = realFetch;
  });

  it("needs a signed-in organiser", async () => {
    signedIn(null);
    const res = await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects bad bodies", async () => {
    expect((await POST(request("{nope"))).status).toBe(400);
    expect((await POST(request({ messages: [], draft: {} }))).status).toBe(400);
    expect(
      (await POST(request({ messages: [{ role: "assistant", content: "hi" }], draft: {} }))).status
    ).toBe(400);
    expect(
      (await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {}, timezone: "Bad/Zone" }))).status
    ).toBe(400);
  });

  it("says plainly when no model key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not configured/);
  });

  it("drafts from pasted text and asks for the next missing thing", async () => {
    modelSays("Drafted BUILD NEXT.", {
      event_name: "BUILD NEXT@Stanford",
      start: "2026-11-06T15:30",
      end: "2026-11-06T17:30",
      timezone: LA,
      location: "Stanford University",
    });
    const res = await POST(
      request({
        messages: [{ role: "user", content: "BUILD NEXT@Stanford, Nov 6 3:30-5:30pm at Stanford" }],
        draft: emptyDraft(LA),
        timezone: LA,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draft).toMatchObject({
      event_name: "BUILD NEXT@Stanford",
      slug: "build-next-stanford",
      start: "2026-11-06T15:30",
      timezone: LA,
    });
    expect(body.reply).toBe("Drafted BUILD NEXT.\n\nWho's hosting it?");
    expect(body.missing).toEqual(["hosts", "require_participant_approval", "participant_capacity"]);
    expect(body.changed).toEqual(["event_name", "start", "end", "timezone", "location"]);

    const sent = mockCreate.mock.calls[0][0];
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.messages[sent.messages.length - 1]).toEqual({
      role: "user",
      content: "BUILD NEXT@Stanford, Nov 6 3:30-5:30pm at Stanford",
    });
  });

  it("applies a follow-up edit to the draft it is sent", async () => {
    modelSays("Moved to 4 PM.", { start: "2026-11-06T16:00", end: "2026-11-06T18:00" });
    const draft = {
      ...emptyDraft(LA),
      event_name: "BUILD NEXT@Stanford",
      slug: "build-next",
      slug_custom: true,
      start: "2026-11-06T15:30",
      end: "2026-11-06T17:30",
      location: "Stanford",
    };
    const res = await POST(
      request({ messages: [{ role: "user", content: "make it 4pm" }], draft, timezone: LA })
    );
    const body = await res.json();
    expect(body.draft.start).toBe("2026-11-06T16:00");
    expect(body.draft.end).toBe("2026-11-06T18:00");
    expect(body.draft.slug).toBe("build-next");
    expect(body.draft.slug_custom).toBe(true);
  });

  it("keeps the draft when the model returns garbage", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "not json at all" } }] });
    const draft = { ...emptyDraft(LA), event_name: "Keep Me" };
    const body = await (await POST(request({ messages: [{ role: "user", content: "x" }], draft, timezone: LA }))).json();
    expect(body.draft.event_name).toBe("Keep Me");
    expect(body.changed).toEqual([]);
  });

  it("returns 502 when the model call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(request({ messages: [{ role: "user", content: "x" }], draft: {} }));
    expect(res.status).toBe(502);
  });

  it("reads a Luma link through Luma's API and hands the model the event", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          data: {
            event: {
              name: "BUILD NEXT@Stanford",
              start_at: "2026-11-06T23:30:00.000Z",
              end_at: "2026-11-07T01:30:00.000Z",
              timezone: LA,
            },
            ticket_info: { require_approval: true },
          },
        }),
    }) as unknown as typeof fetch;
    modelSays("Imported it.", { event_name: "BUILD NEXT@Stanford" });

    const body = await (
      await POST(request({ messages: [{ role: "user", content: "https://luma.com/buildnext" }], draft: {}, timezone: LA }))
    ).json();

    expect(global.fetch).toHaveBeenCalledWith("https://api.lu.ma/url?url=buildnext", expect.anything());
    const sent = mockCreate.mock.calls[0][0].messages;
    const imported = sent[sent.length - 2];
    expect(imported.role).toBe("user");
    expect(imported.content).toContain('"start_local":"2026-11-06T15:30"');
    expect(imported.content).toContain('"require_approval":true');
    expect(body.imported).toBe(true);
  });

  it("answers without the model when a Luma link can't be read", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => "",
    }) as unknown as typeof fetch;
    const body = await (
      await POST(request({ messages: [{ role: "user", content: "https://lu.ma/missing" }], draft: {}, timezone: LA }))
    ).json();
    expect(body.reply).toBe("Luma couldn't find that event. Paste the event text here and I'll draft it from that.");
    expect(body.imported).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("reserves a turn for the verified user before calling the model", async () => {
    modelSays("Hi.", {});
    await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(reserveEventChatTurn).toHaveBeenCalledWith("user-1");
  });

  it("returns 429 with Retry-After at the limit, without calling the model", async () => {
    (reserveEventChatTurn as jest.Mock).mockResolvedValue({ allowed: false, retry_after_seconds: 120 });
    const res = await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the quota check fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    (reserveEventChatTurn as jest.Mock).mockRejectedValue(new Error("db"));
    const res = await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(res.status).toBe(503);
    expect(mockCreate).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("trims an oversized message instead of rejecting the turn", async () => {
    modelSays("Drafted.", {});
    const res = await POST(
      request({ messages: [{ role: "user", content: "x".repeat(DRAFT_CHAT_LIMITS.messageChars + 5000) }], draft: {} })
    );
    expect(res.status).toBe(200);
    const sent = mockCreate.mock.calls[0][0].messages;
    expect(sent[sent.length - 1].content).toHaveLength(DRAFT_CHAT_LIMITS.messageChars);
  });

  it("trims oversized imported data instead of rejecting the turn", async () => {
    modelSays("Drafted.", {});
    const res = await POST(
      request({
        messages: [{ role: "user", content: "https://example.com/event" }],
        draft: {},
        context: "x".repeat(DRAFT_CHAT_LIMITS.contextChars * 3),
      })
    );
    expect(res.status).toBe(200);
  });

  it("does not import a link inside a follow-up edit", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    modelSays("Added it.", {});
    const res = await POST(
      request({
        messages: [{ role: "user", content: "add https://lu.ma/abc123 to the description" }],
        draft: { ...emptyDraft(LA), event_name: "Demo Day" },
      })
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await res.json()).imported).toBe(false);
  });

  it("reports a cut-off reply instead of showing it", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ finish_reason: "length", message: { content: '{"reply":"Draf' } }],
    });
    const res = await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/cut off/);
  });

  it("reports an empty reply", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });
    expect((await POST(request({ messages: [{ role: "user", content: "hi" }], draft: {} }))).status).toBe(502);
  });
});
