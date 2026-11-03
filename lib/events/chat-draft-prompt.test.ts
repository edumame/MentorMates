import { applyDraftPatch, emptyDraft } from "./chat-draft";
import {
  DEFAULT_EVENT_CHAT_MODEL,
  DRAFT_CHAT_LIMITS,
  buildDraftChatMessages,
  eventChatModel,
  parseDraftChatResponse,
} from "./chat-draft-prompt";

const LA = "America/Los_Angeles";

describe("parseDraftChatResponse", () => {
  it("reads the reply and a sanitized patch", () => {
    const raw = JSON.stringify({
      reply: "Moved it to 4 PM. ",
      patch: { start: "2026-11-06T16:00", end: "2026-11-06T18:00", participant_capacity: "lots" },
    });
    expect(parseDraftChatResponse(raw)).toEqual({
      reply: "Moved it to 4 PM.",
      patch: { start: "2026-11-06T16:00", end: "2026-11-06T18:00" },
    });
  });

  it("accepts JSON wrapped in fences or prose", () => {
    expect(parseDraftChatResponse('```json\n{"reply":"Hi","patch":{"slug":"build-next"}}\n```')).toEqual({
      reply: "Hi",
      patch: { slug: "build-next" },
    });
    expect(parseDraftChatResponse('Sure! {"reply":"Ok","patch":null} thanks')).toEqual({ reply: "Ok", patch: {} });
  });

  it("never patches from a reply that is not JSON", () => {
    expect(parseDraftChatResponse("I can help with that.")).toEqual({ reply: "I can help with that.", patch: {} });
    expect(parseDraftChatResponse("[1,2]")).toEqual({ reply: "[1,2]", patch: {} });
    expect(parseDraftChatResponse('{"patch":{"event_name":"Hack Day"}}')).toEqual({
      reply: "",
      patch: { event_name: "Hack Day" },
    });
  });
});

describe("buildDraftChatMessages", () => {
  it("sends the rules, the draft and what is missing, then the turns", () => {
    const draft = applyDraftPatch(emptyDraft(LA), { event_name: "Spring Hack", slug: "spring" });
    const messages = buildDraftChatMessages({
      history: [{ role: "user", content: "Spring Hack, Stanford" }],
      draft,
      timezone: LA,
      now: new Date("2026-11-03T12:00:00Z"),
    });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Today is 2026-11-03");
    expect(messages[0].content).toContain(LA);
    expect(messages[1].content).toContain('"event_name":"Spring Hack"');
    expect(messages[1].content).not.toContain("slug_custom");
    expect(messages[1].content).toContain("Still unknown: start, location");
    expect(messages[2]).toEqual({ role: "user", content: "Spring Hack, Stanford" });
  });

  it("includes imported link data and trims long history", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: `turn ${i}`,
    }));
    const messages = buildDraftChatMessages({
      history,
      draft: emptyDraft(LA),
      context: '{"name":"Imported"}',
      timezone: LA,
    });
    expect(messages[1].content).toContain('Data imported from the link the organiser pasted:\n{"name":"Imported"}');
    expect(messages).toHaveLength(2 + DRAFT_CHAT_LIMITS.historyTurns);
    expect(messages[messages.length - 1].content).toBe("turn 29");
  });
});

describe("eventChatModel", () => {
  const prev = process.env.OPENAI_EVENT_CHAT_MODEL;
  afterEach(() => {
    if (prev === undefined) delete process.env.OPENAI_EVENT_CHAT_MODEL;
    else process.env.OPENAI_EVENT_CHAT_MODEL = prev;
  });

  it("defaults and can be overridden per deployment", () => {
    delete process.env.OPENAI_EVENT_CHAT_MODEL;
    expect(eventChatModel()).toBe(DEFAULT_EVENT_CHAT_MODEL);
    process.env.OPENAI_EVENT_CHAT_MODEL = "gpt-test";
    expect(eventChatModel()).toBe("gpt-test");
  });
});
