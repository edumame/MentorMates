import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

const RequestSchema = z.object({
  eventId: z.string().min(1),
  url: z.string().url().optional(),
  mode: z.enum(["import", "enhance", "generate"]),
  context: z.object({
    event_name: z.string().optional(),
    event_date: z.string().optional(),
    location: z.string().optional(),
    existing_description: z.string().optional(),
    field: z.string().optional(), // Which field to enhance/generate
  }).optional(),
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
    // Try to extract the first JSON object in the text
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = text.slice(start, end + 1);
      try {
        return JSON.parse(maybeJson);
      } catch {
        // no-op
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

function deriveSlugFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const firstLabel = host.split(".")[0] || "";
    const s = slugify(firstLabel);
    return s || undefined;
  } catch {
    return undefined;
  }
}

async function scrapeUrl(url: string): Promise<string> {
  // Try to fetch the URL directly
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MentorMate/1.0; +https://mentormate.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // Basic HTML to text conversion (strip tags, keep content)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 10000); // Limit to first 10k characters
  } catch (error) {
    throw new Error(`Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
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

    const { eventId, url, mode, context } = parsed.data;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization: organizer of this event OR admin
    let isAllowed = false;
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleRow && typeof roleRow.role === "string") {
      isAllowed = ["organizer", "admin"].includes(roleRow.role);
    }

    if (!isAllowed) {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact your administrator." },
        { status: 503 }
      );
    }

    let scrapeData = "";

    // If URL is provided and mode is import, scrape it
    if (url && mode === "import") {
      scrapeData = await scrapeUrl(url);
    }

    // Prepare AI prompt based on mode
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "import") {
      systemPrompt = `You are an assistant that converts hackathon event pages into a structured event JSON used by a Next.js app. Extract ONLY event-level details (not project-level). Output MUST be STRICT JSON with no code fences or commentary and match this TypeScript-like shape:
{
  "slug"?: string,                        // url-friendly lowercase-hyphen slug
  "event_name"?: string,
  "event_date"?: string,                 // Prefer YYYY-MM-DD if determinable
  "location"?: string,
  "event_blurb"?: string,                // 1-2 sentence summary
  "event_description"?: string,          // Markdown combining About/What to Build/What to Submit/etc
  "submission_time_start"?: string,      // ISO 8601 when available
  "submission_time_cutoff"?: string,     // ISO 8601 when available
  "event_schedule"?: Array<{
    "time": string,                      // e.g., "Day 1" or "2025-10-04"
    "events": Array<{
      "name": string,
      "time": string,                    // e.g., "10:00 AM - 11:30 AM"
      "description"?: string
    }>
  }>,
  "rules"?: Array<{ "title": string, "items": string[] }>,
  "event_resources"?: Array<{ "name": string, "link": string }>
  "faq"?: string,                        // markdown FAQ if present
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
}

Rules:
- If a field is unknown, omit it.
- If slug is available or derivable (from the page branding/name), include a url-safe lowercase-hyphen slug.
- Prefer concise, human-friendly markdown in event_description.
- Derive a short blurb from the first paragraph if possible.
- Convert dates/times into clear human-readable strings; use YYYY-MM-DD for event_date when possible.
- Include "What to Submit" items under rules with a suitable section title.
- Include prominent prize or track summaries in description if relevant.
- When tracks or prizes are listed (judging tracks, prize categories), include them in "tracks" and attach prizes to the corresponding track.
`;
      userPrompt = scrapeData;
    } else if (mode === "enhance") {
      // Enhance existing content
      const field = context?.field || "event_description";
      const existingContent = context?.existing_description || "";

      systemPrompt = `You are an assistant that helps enhance hackathon event content. The user wants to improve their ${field}. Provide an enhanced version that is more engaging, professional, and informative. Return ONLY the enhanced text, no JSON, no code fences, no commentary.`;

      userPrompt = `Event Name: ${context?.event_name || "Not provided"}
Event Date: ${context?.event_date || "Not provided"}
Location: ${context?.location || "Not provided"}

Current ${field}:
${existingContent}

Please enhance this to be more engaging and professional while keeping the core information.`;
    } else if (mode === "generate") {
      // Generate new content from scratch
      const field = context?.field || "event_description";

      systemPrompt = `You are an assistant that helps generate hackathon event content. The user wants to generate ${field} for their event. Provide professional, engaging content. Return ONLY the generated text, no JSON, no code fences, no commentary.`;

      userPrompt = `Event Name: ${context?.event_name || "Not provided"}
Event Date: ${context?.event_date || "Not provided"}
Location: ${context?.location || "Not provided"}

Please generate a professional ${field} for this hackathon event.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: mode === "import" ? 1500 : 800,
    });

    const content = completion.choices?.[0]?.message?.content || "";

    if (mode === "import") {
      const json = extractJsonFromText(content);
      if (!json) {
        return NextResponse.json(
          {
            error: "Failed to parse AI output",
            raw: content,
          },
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

      const normalized = { ...validated.data } as z.infer<typeof EventImportSchema>;
      if (normalized.event_date) {
        const iso = coerceToIsoDate(normalized.event_date);
        if (iso) normalized.event_date = iso;
      }

      // Ensure a valid slug is present if derivable
      const allowed = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      let finalSlug = normalized.slug && allowed.test(normalized.slug)
        ? normalized.slug
        : undefined;
      if (!finalSlug && normalized.event_name) {
        const s = slugify(normalized.event_name);
        if (allowed.test(s)) finalSlug = s;
      }
      if (!finalSlug && url) {
        const fromUrl = deriveSlugFromUrl(url);
        if (fromUrl && allowed.test(fromUrl)) finalSlug = fromUrl;
      }
      if (finalSlug) normalized.slug = finalSlug;

      return NextResponse.json({ import: normalized });
    } else {
      // For enhance/generate modes, return the content directly
      return NextResponse.json({ content });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
