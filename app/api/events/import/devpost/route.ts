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
  date: z.string(),
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

const FaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const EventImportSchema = z.object({
  slug: z.string().optional(),
  event_name: z.string().optional(),
  event_date: z.string().optional(),
  location: z.string().optional(),
  cover_image_url: z.string().url().optional(),
  event_blurb: z.string().optional(),
  event_description: z.string().optional(),
  submission_time_start: z.string().optional(),
  submission_time_cutoff: z.string().optional(),
  event_schedule: z.array(ScheduleDaySchema).optional(),
  rules: z.array(RuleSectionSchema).optional(),
  event_resources: z.array(ResourceSchema).optional(),
  faqs: z.array(FaqItemSchema).optional(),
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

    const systemPrompt = `You are an assistant that converts Devpost hackathon pages into a structured hackathon event JSON used by a Next.js app. Extract event-level details. Output MUST be STRICT JSON with no code fences or commentary.

CRITICAL INSTRUCTIONS:
1. PRESERVE ORIGINAL TEXT: Copy text content exactly as it appears in the source. Do NOT summarize, paraphrase, or shorten descriptions, rules, FAQs, or any other text content. Include the full original wording.
2. DATE FORMATS: All date fields MUST be in ISO 8601 format:
   - event_date: "YYYY-MM-DD" (the main event date)
   - submission_time_start: "YYYY-MM-DDTHH:MM:SS" (when submissions open - REQUIRED if available)
   - submission_time_cutoff: "YYYY-MM-DDTHH:MM:SS" (submission deadline - REQUIRED if available)
   Look for phrases like "submissions open", "submissions due", "deadline", "submit by", etc. to find these dates.
3. COMPLETENESS: Extract ALL available information from the source - every rule, every FAQ, every resource, every track with full descriptions.
4. EVENT_BLURB: Create a compelling one-liner (max 150 characters) that captures the essence of the hackathon. This should be catchy and suitable for marketing/preview purposes.

Output must match this TypeScript-like shape:
{
  "slug"?: string,
  "event_name"?: string,
  "event_date"?: string (ISO format: YYYY-MM-DD, the main event date),
  "location"?: string,
  "cover_image_url"?: string (URL of the main event banner, cover image, or hero image. Look for the largest prominent image near the top of the page, event logo/banner, or og:image meta tag. Must be a full absolute URL starting with https://),
  "event_blurb"?: string (REQUIRED: a catchy one-liner, max 150 chars, summarizing the hackathon's purpose/theme),
  "event_description"?: string (FULL description text, preserve all paragraphs and formatting),
  "submission_time_start"?: string (ISO format: YYYY-MM-DDTHH:MM:SS - when submissions open),
  "submission_time_cutoff"?: string (ISO format: YYYY-MM-DDTHH:MM:SS - submission deadline),
  "event_schedule"?: Array<{
    "date": string (ISO format: YYYY-MM-DD, the day this schedule is for),
    "events": Array<{
      "name": string (event/activity name),
      "time": string (time in HH:MM format, 24-hour),
      "description"?: string (optional description)
    }>
  }>,
  "rules"?: Array<{
    "title": string (section title like "Eligibility", "Submissions", etc.),
    "items": string[] (array of rule items, preserve FULL text of each rule)
  }>,
  "event_resources"?: Array<{ "name": string, "link": string }>,
  "faqs"?: Array<{
    "question": string (the FAQ question),
    "answer": string (the full answer, preserve all formatting)
  }>,
  "tracks"?: Array<{
    "name": string (track/category name),
    "description"?: string (FULL track description),
    "label"?: string (short label),
    "prizes"?: Array<{
      "prize_amount": string (e.g. "$1000", "First Place"),
      "prize_description": string (full prize description)
    }>,
    "criteria"?: Array<{
      "name": string (criterion name),
      "description"?: string (criterion description),
      "weight"?: number (default 1),
      "min"?: number (min score, default 1),
      "max"?: number (max score, default 10)
    }>
  }>
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: scrapeData },
      ],
      temperature: 0.2,
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
