/**
 * Prompt and reply parsing for the event creation chat (POST
 * /api/events/chat-draft). Pure: the route owns the OpenAI call.
 */

import {
  ASKED_FIELDS,
  FIELD_QUESTIONS,
  REQUIRED_FIELDS,
  missingFields,
  sanitizeDraftPatch,
  type DraftPatch,
  type EventDraft,
} from "./chat-draft";

export interface DraftChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const DRAFT_CHAT_LIMITS = {
  /** Turns of history sent to the model (the newest are kept). */
  historyTurns: 20,
  /** Characters per message (a pasted event page fits). */
  messageChars: 20_000,
  /** Characters of imported page data passed as context. */
  contextChars: 15_000,
} as const;

/** Model for the chat; override per deployment with OPENAI_EVENT_CHAT_MODEL. */
export const DEFAULT_EVENT_CHAT_MODEL = "gpt-5.4";

export function eventChatModel(): string {
  return process.env.OPENAI_EVENT_CHAT_MODEL?.trim() || DEFAULT_EVENT_CHAT_MODEL;
}

const ASK_ORDER = [...REQUIRED_FIELDS, ...ASKED_FIELDS]
  .map((f, i) => `${i + 1}. ${f}: "${FIELD_QUESTIONS[f]}"`)
  .join("\n");

export function buildSystemPrompt(now: Date, timezone: string): string {
  return `You help an organiser create an event on MentorMates by chatting. There are no forms: you keep a JSON draft of the event and update it from what they say, paste, or import.

Today is ${now.toISOString().slice(0, 10)}. The organiser's browser time zone is ${timezone}.

Draft fields (all optional in a patch):
- event_name: string, the event's title as the organiser or source writes it.
- start, end: wall-clock time in the event's time zone, "YYYY-MM-DDTHH:mm" (24h). No offsets, no "Z". A date with no year is the next one on or after today.
- timezone: IANA zone of the event, e.g. "America/Los_Angeles". Infer it from the location or from "PT/ET/GMT". Otherwise keep the current one.
- location: string, venue and city as given.
- event_blurb: one or two plain sentences, under 200 characters.
- event_description: Markdown. Use "## " and "### " headings, short paragraphs and "- " bullets. Keep the source's facts; do not invent prizes, sponsors or numbers.
- schedule: [{ "day": "Friday, Nov 6", "items": [{ "time": "3:30 PM", "name": "Check-in", "description"?: string }] }].
- hosts: string, the hosting organisations or people, comma separated.
- require_participant_approval: boolean. true when the source says "approval required", "apply", "registration requires approval".
- participant_capacity: positive integer, or "unlimited" when the organiser says there is no cap.
- slug: short URL id for mentormates.ai/events/<slug>: lowercase letters, digits and hyphens.
- event_type: array of lowercase words, e.g. ["hackathon"], ["workshop"], ["demo-day"].

Respond with STRICT JSON only, no code fences:
{ "reply": "<what you changed, then at most one question>", "patch": { <only fields to change> } }

Rules:
- The first time there is enough to go on (a pasted page, a link's data, a description), fill every field you can at once, including a blurb, a Markdown description, the schedule and a short slug.
- Imported link data is the source of truth for facts. When it has start_local / end_local and timezone, use them as start, end and timezone exactly. Its description_markdown is the description to tidy, not to rewrite.
- After that, change only what the organiser asks for. "make it 4pm" moves the start to 16:00 and keeps the length of the event by moving the end too. "slug build-next" sets slug.
- If the organiser asks a question, answer it briefly; patch may be {}.
- Keep "reply" short and plain: one or two sentences, no lists, no headings, no bold. Do not repeat the whole draft back; the organiser sees it in a preview.
- Then, if any of these are still unknown after your patch, end the reply with ONE short question about the first one, in this order:
${ASK_ORDER}
- Never ask about something already in the draft. Never ask more than one question.
- When nothing is missing, say it is ready and that they can press Create event, or keep editing.`;
}

/** The draft as the model sees it: slug_custom is bookkeeping, not something it sets. */
function draftForPrompt(draft: EventDraft): Omit<EventDraft, "slug_custom"> {
  const rest: Partial<EventDraft> = { ...draft };
  delete rest.slug_custom;
  return rest as Omit<EventDraft, "slug_custom">;
}

export function buildDraftChatMessages({
  history,
  draft,
  context,
  now = new Date(),
  timezone,
}: {
  history: DraftChatTurn[];
  draft: EventDraft;
  context?: string | null;
  now?: Date;
  timezone: string;
}): { role: "system" | "user" | "assistant"; content: string }[] {
  const turns = history
    .slice(-DRAFT_CHAT_LIMITS.historyTurns)
    .map((t) => ({ role: t.role, content: t.content.slice(0, DRAFT_CHAT_LIMITS.messageChars) }));
  const state = [
    `Current draft:\n${JSON.stringify(draftForPrompt(draft))}`,
    `Still unknown: ${missingFields(draft).join(", ") || "nothing"}`,
    context ? `Data imported from the link the organiser pasted:\n${context.slice(0, DRAFT_CHAT_LIMITS.contextChars)}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: buildSystemPrompt(now, timezone) },
    { role: "system", content: state },
    ...turns,
  ];
}

export interface DraftChatResult {
  reply: string;
  patch: DraftPatch;
}

function extractJsonObject(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Reads the model's reply. Anything that is not the expected JSON becomes a
 * plain reply with no patch, so a bad completion never corrupts the draft.
 */
export function parseDraftChatResponse(raw: string): DraftChatResult {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { reply: raw.trim(), patch: {} };
  }
  const obj = parsed as { reply?: unknown; patch?: unknown };
  return {
    reply: typeof obj.reply === "string" ? obj.reply.trim() : "",
    patch: sanitizeDraftPatch(obj.patch),
  };
}
