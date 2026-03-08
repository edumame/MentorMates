import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const EVENT_SCRAPER_URL =
  process.env.EVENT_SCRAPER_URL || "https://event-scraper-cyu60s-projects.vercel.app";

const RequestSchema = z.object({
  url: z.string().url(),
});

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

    // Call the external Event Scraper API
    const scrapeRes = await fetch(`${EVENT_SCRAPER_URL}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!scrapeRes.ok) {
      const errBody = await scrapeRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errBody?.error || "Failed to scrape event page" },
        { status: 502 }
      );
    }

    const result = await scrapeRes.json();
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Scraper returned no data" },
        { status: 502 }
      );
    }

    const imported = result.data as Record<string, unknown>;

    // Ensure a valid slug
    const allowed = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    let slug = typeof imported.slug === "string" && allowed.test(imported.slug)
      ? imported.slug
      : undefined;
    if (!slug && typeof imported.event_name === "string") {
      const s = slugify(imported.event_name);
      if (allowed.test(s)) slug = s;
    }
    if (slug) imported.slug = slug;

    return NextResponse.json({ import: imported });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/events/import/devpost:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
