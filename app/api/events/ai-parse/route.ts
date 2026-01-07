import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventVisibility } from "@/lib/types";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

const RequestSchema = z.object({
  text: z.string().min(1),
  mode: z.enum(["fill", "generate"]).optional().default("fill"),
});

const ParsedEventSchema = z.object({
  slug: z.string().optional(),
  event_name: z.string().optional(),
  event_date: z.string().optional(),
  location: z.string().optional(),
  event_blurb: z.string().optional(),
  event_description: z.string().optional(),
  cover_image_url: z.string().url().optional(),
  submission_time_start: z.string().optional(),
  submission_time_cutoff: z.string().optional(),
  paid: z.boolean().optional(),
  visibility: z
    .enum([
      EventVisibility.Public,
      EventVisibility.Private,
      EventVisibility.Draft,
      EventVisibility.Demo,
      EventVisibility.Test,
      EventVisibility.Archived,
    ])
    .optional(),
});

type ParsedEvent = z.infer<typeof ParsedEventSchema>;

function coerceToIsoDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = text.slice(start, end + 1);
      try {
        return JSON.parse(maybeJson);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function mapVisibility(input?: string): EventVisibility | undefined {
  if (!input) return undefined;
  const v = input.toLowerCase();
  if (["public", "private", "draft", "demo", "test", "archived"].includes(v)) {
    return v as EventVisibility;
  }
  return undefined;
}

function heuristicParse(text: string): ParsedEvent {
  // Very light heuristics if no OpenAI: try to pull basic fields
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(" \n");

  const nameMatch = /(?:^|\n)(?:event\s*name|title)\s*[:\-]\s*(.+)$/i.exec(text);
  const dateMatch = /(?:^|\n)(?:date|when)\s*[:\-]\s*([^\n]+)/i.exec(text);
  const locMatch = /(?:^|\n)(?:location|where)\s*[:\-]\s*([^\n]+)/i.exec(text);

  const urlMatch = /(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))/i.exec(text);

  // If first line is reasonably short, treat as a possible title
  const possibleTitle = !nameMatch && lines[0] && lines[0].length <= 120 ? lines[0] : undefined;

  // Blurb from first 1-2 sentences
  const firstSentences = joined.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");

  const out: ParsedEvent = {
    event_name: (nameMatch?.[1] || possibleTitle || "").trim() || undefined,
    event_date: coerceToIsoDate(dateMatch?.[1]?.trim()) || dateMatch?.[1]?.trim(),
    location: locMatch?.[1]?.trim(),
    event_blurb: firstSentences || undefined,
    event_description: text.trim(),
    cover_image_url: urlMatch?.[1],
  };

  return out;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();

  try {
    const body = await req.json();
    const parsedReq = RequestSchema.safeParse(body);
    if (!parsedReq.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsedReq.error.flatten() },
        { status: 400 }
      );
    }

    const { text, mode } = parsedReq.data;

    // Auth: must be authenticated and an admin (same visibility as create event)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // const { data: isAdmin } = await supabase.rpc("is_admin_user", { user_id: user.id });
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    // If no OpenAI, fallback to heuristics
    if (!process.env.OPENAI_API_KEY) {
      const fields = heuristicParse(text);
      const normalized: ParsedEvent = { ...fields };
      if (normalized.event_date) {
        const iso = coerceToIsoDate(normalized.event_date);
        if (iso) normalized.event_date = iso;
      }
      return NextResponse.json({ normalized, warning: "OPENAI_API_KEY not configured. Used heuristic parsing." });
    }

    const systemPromptFill = `You are an assistant that EXTRACTS a structured JSON for a hackathon/event from pasted text. Output STRICT JSON with only these optional fields if present:
{
  "slug"?: string,
  "event_name"?: string,
  "event_date"?: string,            // Prefer YYYY-MM-DD if determinable
  "location"?: string,
  "event_blurb"?: string,           // 1-2 sentence summary
  "event_description"?: string,     // Markdown-friendly
  "cover_image_url"?: string,       // Public image URL if present
  "submission_time_start"?: string, // ISO 8601 if present
  "submission_time_cutoff"?: string,// ISO 8601 if present
  "paid"?: boolean,                 // true if paid ticketing is clearly stated; false if clearly free
  "visibility"?: "public" | "private" | "draft" | "demo" | "test" | "archived"
}
Rules:
- If a field is unknown, omit it.
- Keep description concise but informative.
- Do NOT include code fences or commentary, JSON only.`;

    const systemPromptGenerate = `You are an assistant that GENERATES a plausible event JSON from a short brief. Output STRICT JSON with the same shape as above. Prefer realistic details, concise blurb, and YYYY-MM-DD for date.`;

    const system = mode === "generate" ? `${systemPromptFill}\n\n${systemPromptGenerate}` : systemPromptFill;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      temperature: mode === "generate" ? 0.5 : 0.2,
      max_tokens: 900,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const json = extractJsonFromText(content);
    if (!json) {
      return NextResponse.json(
        { error: "Failed to parse AI output", raw: content },
        { status: 502 }
      );
    }

    const validated = ParsedEventSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid AI output", details: validated.error.flatten(), raw: content },
        { status: 502 }
      );
    }

    const fields: ParsedEvent = { ...validated.data };

    if (fields.event_date) {
      const iso = coerceToIsoDate(fields.event_date);
      if (iso) fields.event_date = iso;
    }

    if (fields.visibility) {
      fields.visibility = mapVisibility(fields.visibility) as ParsedEvent["visibility"];
    }

    return NextResponse.json({ fields });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/events/ai-parse:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
