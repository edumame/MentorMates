import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  applyDraftPatch,
  eventLinkIn,
  isValidTimeZone,
  missingFields,
  sanitizeDraft,
  withNextQuestion,
} from "@/lib/events/chat-draft";
import {
  DRAFT_CHAT_LIMITS,
  buildDraftChatMessages,
  eventChatModel,
  parseDraftChatResponse,
} from "@/lib/events/chat-draft-prompt";
import {
  LumaImportError,
  fetchLumaEvent,
  lumaEventSlug,
} from "@/lib/events/luma-import";

export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(DRAFT_CHAT_LIMITS.messageChars),
      })
    )
    .min(1)
    .max(200)
    // zod runs refinements even after .min(1) fails, so guard the empty list.
    .refine((m) => m.length > 0 && m[m.length - 1].role === "user", {
      message: "The last message must be the organiser's",
    }),
  draft: z.unknown(),
  timezone: z.string().refine(isValidTimeZone).optional(),
  context: z.string().max(DRAFT_CHAT_LIMITS.contextChars * 2).nullable().optional(),
});

/**
 * One turn of the event creation chat: the organiser's latest message (and
 * any imported link data) in, the assistant's reply and the updated draft
 * out. Nothing is written here; Create goes through POST /api/events.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant is not configured on this server." },
      { status: 503 }
    );
  }

  const timezone = parsed.data.timezone ?? "UTC";
  const draft = sanitizeDraft(parsed.data.draft, timezone);

  // A Luma link is read here, in one request to Luma's API; other links come
  // with `context` from the client's call to the general scraper.
  let context = parsed.data.context ?? null;
  const latest = parsed.data.messages[parsed.data.messages.length - 1].content;
  const link = eventLinkIn(latest);
  const lumaSlug = !context && link ? lumaEventSlug(link) : null;
  if (lumaSlug && link) {
    try {
      context = JSON.stringify(await fetchLumaEvent(lumaSlug, link));
    } catch (error) {
      const why = error instanceof LumaImportError ? error.message : "I couldn't read that link.";
      return NextResponse.json({
        reply: `${why} Paste the event text here and I'll draft it from that.`,
        draft,
        changed: [],
        missing: missingFields(draft),
        imported: false,
      });
    }
  }

  const messages = buildDraftChatMessages({
    history: parsed.data.messages,
    draft,
    context,
    timezone,
  });

  let raw: string;
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: eventChatModel(),
      messages,
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });
    raw = completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("Event chat draft: model call failed", error);
    return NextResponse.json(
      { error: "The assistant could not answer just now. Try again." },
      { status: 502 }
    );
  }

  const { reply, patch } = parseDraftChatResponse(raw);
  const next = applyDraftPatch(draft, patch);

  return NextResponse.json({
    reply: withNextQuestion(reply, next),
    draft: next,
    changed: Object.keys(patch),
    missing: missingFields(next),
    imported: Boolean(context),
  });
}
