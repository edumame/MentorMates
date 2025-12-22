import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

const RequestSchema = z.object({
  url: z.string().url(),
});

const ScheduleEventSchema = z.object({
  name: z.string(),
  time: z.string(),
  description: z.string().optional(),
});

const ScheduleDaySchema = z.object({
  time: z.string(),
  events: z.array(ScheduleEventSchema),
});

const RuleSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

const ResourceSchema = z.object({
  name: z.string(),
  link: z.string(),
});

const PrizeImportSchema = z.object({
  prize_amount: z.string(),
  prize_description: z.string(),
});

const CriterionImportSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  weight: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  type: z.enum(["numeric", "multiplechoice"]).optional(),
  options: z.array(z.string()).optional(),
});

const TrackImportSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  label: z.string().optional(),
  prizes: z.array(PrizeImportSchema).optional(),
  criteria: z.array(CriterionImportSchema).optional(),
});

const EventImportSchema = z.object({
  slug: z.string().optional(),
  event_name: z.string().optional(),
  event_date: z.string().optional(),
  location: z.string().optional(),
  event_blurb: z.string().optional(),
  event_description: z.string().optional(),
  submission_time_start: z.string().optional(),
  submission_time_cutoff: z.string().optional(),
  event_schedule: z.array(ScheduleDaySchema).optional(),
  rules: z.array(RuleSectionSchema).optional(),
  event_resources: z.array(ResourceSchema).optional(),
  faq: z.string().optional(),
  tracks: z.array(TrackImportSchema).optional(),
});

type EventImport = z.infer<typeof EventImportSchema>;

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scrapeRes = await fetch(
      "https://magicloops.dev/api/loop/f4679572-e8bd-425a-a979-960f9e3a7cd7/run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }
    );

    if (!scrapeRes.ok) {
      return NextResponse.json(
        { error: "Failed to scrape Devpost", statusText: scrapeRes.statusText },
        { status: 502 }
      );
    }

    const scraped = (await scrapeRes.json()) as { scrape_data?: string };
    const scrapeData = scraped?.scrape_data || "";

    if (!scrapeData) {
      return NextResponse.json(
        { error: "No scrape data returned from scraper" },
        { status: 502 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        import: {
          event_description: scrapeData,
        },
        warning:
          "OPENAI_API_KEY not configured. Returned raw scrape text in event_description.",
      });
    }

    const systemPrompt = `You are an assistant that converts Devpost hackathon pages into a structured hackathon event JSON used by a Next.js app. Extract ONLY event-level details (not project-level). Output MUST be STRICT JSON with no code fences or commentary and match this TypeScript-like shape:
{
  "slug"?: string,
  "event_name"?: string,
  "event_date"?: string,
  "location"?: string,
  "event_blurb"?: string,
  "event_description"?: string,
  "submission_time_start"?: string,
  "submission_time_cutoff"?: string,
  "event_schedule"?: Array<{
    "time": string,
    "events": Array<{
      "name": string,
      "time": string,
      "description"?: string
    }>
  }>,
  "rules"?: Array<{ "title": string, "items": string[] }>,
  "event_resources"?: Array<{ "name": string, "link": string }>,
  "faq"?: string,
  "tracks"?: Array<{
    "name": string,
    "description"?: string,
    "label"?: string,
    "prizes"?: Array<{ "prize_amount": string, "prize_description": string }>,
    "criteria"?: Array<{
      "name": string,
      "description"?: string,
      "weight"?: number,
      "min"?: number,
      "max"?: number,
      "type"?: "numeric" | "multiplechoice",
      "options"?: string[]
    }>
  }>
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: scrapeData },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const json = extractJsonFromText(content);
    if (!json) {
      return NextResponse.json(
        { error: "Failed to parse AI output", raw: content },
        { status: 502 }
      );
    }

    const validated = EventImportSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid AI output", details: validated.error.flatten() },
        { status: 502 }
      );
    }

    const normalized: EventImport = { ...validated.data };
    if (normalized.event_date) {
      const iso = coerceToIsoDate(normalized.event_date);
      if (iso) normalized.event_date = iso;
    }

    const allowed = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (normalized.slug && !allowed.test(normalized.slug)) {
      normalized.slug = undefined;
    }

    if (!normalized.slug && normalized.event_name) {
      const s = slugify(normalized.event_name);
      if (allowed.test(s)) normalized.slug = s;
    }

    return NextResponse.json({ import: normalized });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/events/import/devpost:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}



